import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  ImportBatchStatus,
  ImportResolution,
  ImportRowStatus,
  ImportSource,
  type Prisma,
} from "@prisma/client";
import {
  InvoiceUpsertService,
  type UpsertInvoiceInput,
  type WriteContext,
} from "../invoices/invoice-upsert.service";
import {
  diffSnapshots,
  snapshotFromInput,
  snapshotFromInvoice,
} from "../invoices/invoice-snapshot.util";
import { PrismaService } from "../prisma/prisma.service";

export interface AnalyzeRowInput {
  rowNumber: number;
  rawPayload: Record<string, unknown>;
  mapped: UpsertInvoiceInput;
  errorMessage?: string;
}

export interface AnalyzeBatchContext {
  source: ImportSource;
  spreadsheetUploadId?: string;
  scanUploadId?: string;
  connectorId?: string;
  apiKeyId?: string;
  createdByUserId?: string;
  changeSource: string;
}

export interface AnalyzeRowResult {
  importRowId: string;
  rowNumber: number;
  invoiceNumber: string;
  status: ImportRowStatus;
  existing?: Record<string, unknown>;
  incoming: Record<string, unknown>;
  changedFields: string[];
  invoiceId?: string;
  errorMessage?: string;
}

export interface AnalyzeBatchResult {
  batchId: string;
  status: ImportBatchStatus;
  summary: {
    new: number;
    unchanged: number;
    conflict: number;
    duplicate_in_file: number;
    error: number;
    imported: number;
  };
  rows: AnalyzeRowResult[];
}

@Injectable()
export class ImportAnalyzeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly upsert: InvoiceUpsertService,
  ) {}

  async analyzeBatch(
    rows: AnalyzeRowInput[],
    context: AnalyzeBatchContext,
  ): Promise<AnalyzeBatchResult> {
    const batch = await this.prisma.importBatch.create({
      data: {
        source: context.source,
        status: ImportBatchStatus.analyzing,
        spreadsheetUploadId: context.spreadsheetUploadId ?? null,
        scanUploadId: context.scanUploadId ?? null,
        connectorId: context.connectorId ?? null,
        apiKeyId: context.apiKeyId ?? null,
        createdByUserId: context.createdByUserId ?? null,
      },
    });

    const writeContext: WriteContext = {
      source: context.changeSource,
      actorUserId: context.createdByUserId,
      actorApiKeyId: context.apiKeyId,
    };

    const seenInFile = new Map<string, number>();
    const results: AnalyzeRowResult[] = [];
    const summary = {
      new: 0,
      unchanged: 0,
      conflict: 0,
      duplicate_in_file: 0,
      error: 0,
      imported: 0,
    };

    for (const row of rows) {
      if (row.errorMessage) {
        const importRow = await this.createImportRow(batch.id, row, {
          status: ImportRowStatus.error,
          errorMessage: row.errorMessage,
        });
        summary.error++;
        results.push(this.toAnalyzeResult(importRow, row.mapped));
        continue;
      }

      const invoiceNumber = row.mapped.invoiceNumber;
      if (seenInFile.has(invoiceNumber)) {
        const importRow = await this.createImportRow(batch.id, row, {
          status: ImportRowStatus.duplicate_in_file,
          errorMessage: `Duplicate invoice_number in batch (first at row ${seenInFile.get(invoiceNumber)})`,
        });
        summary.duplicate_in_file++;
        results.push(this.toAnalyzeResult(importRow, row.mapped));
        continue;
      }
      seenInFile.set(invoiceNumber, row.rowNumber);

      const existing = await this.prisma.invoice.findUnique({
        where: { invoiceNumber },
      });
      const incomingSnapshot = snapshotFromInput(row.mapped);
      const classification = this.upsert.classify(existing, row.mapped);

      if (classification === "new") {
        const { invoiceId } = await this.upsert.insertNew(row.mapped, {
          ...writeContext,
        });
        const importRow = await this.createImportRow(batch.id, row, {
          status: ImportRowStatus.imported,
          invoiceId,
        });
        summary.new++;
        summary.imported++;
        results.push({
          ...this.toAnalyzeResult(importRow, row.mapped),
          invoiceId,
        });
        continue;
      }

      if (classification === "unchanged" && existing) {
        const { invoiceId } = await this.upsert.touchUnchanged(existing, {
          ...writeContext,
        });
        const importRow = await this.createImportRow(batch.id, row, {
          status: ImportRowStatus.unchanged,
          invoiceId,
          existingSnapshot: snapshotFromInvoice(existing),
        });
        summary.unchanged++;
        results.push({
          ...this.toAnalyzeResult(importRow, row.mapped, existing),
          invoiceId,
        });
        continue;
      }

      const existingSnapshot = existing
        ? snapshotFromInvoice(existing)
        : undefined;
      const changedFields = existingSnapshot
        ? diffSnapshots(existingSnapshot, incomingSnapshot)
        : [];

      const importRow = await this.createImportRow(batch.id, row, {
        status: ImportRowStatus.conflict,
        invoiceId: existing?.id,
        existingSnapshot,
        changedFields,
      });
      summary.conflict++;
      results.push(this.toAnalyzeResult(importRow, row.mapped, existing));
    }

    const status =
      summary.conflict > 0
        ? ImportBatchStatus.pending_review
        : ImportBatchStatus.committed;

    await this.prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        status,
        stats: summary as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      batchId: batch.id,
      status,
      summary,
      rows: results,
    };
  }

  async getBatch(batchId: string) {
    const batch = await this.prisma.importBatch.findUnique({
      where: { id: batchId },
      include: {
        rows: { orderBy: { rowNumber: "asc" } },
        connector: { select: { id: true, name: true } },
        spreadsheetUpload: {
          select: { id: true, originalFilename: true },
        },
        scanUpload: { select: { id: true, originalFilename: true } },
      },
    });
    if (!batch) {
      throw new NotFoundException("Import batch not found");
    }
    return batch;
  }

  listPendingBatches(limit = 50) {
    return this.prisma.importBatch.findMany({
      where: { status: ImportBatchStatus.pending_review },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        connector: { select: { id: true, name: true } },
        spreadsheetUpload: {
          select: { id: true, originalFilename: true },
        },
        scanUpload: { select: { id: true, originalFilename: true } },
        _count: { select: { rows: true } },
      },
    });
  }

  private async createImportRow(
    batchId: string,
    row: AnalyzeRowInput,
    extra: {
      status: ImportRowStatus;
      invoiceId?: string;
      existingSnapshot?: Record<string, unknown>;
      changedFields?: string[];
      errorMessage?: string;
    },
  ) {
    return this.prisma.importRow.create({
      data: {
        batchId,
        rowNumber: row.rowNumber,
        invoiceNumber: row.mapped.invoiceNumber,
        invoiceId: extra.invoiceId ?? null,
        rawPayload: row.rawPayload as Prisma.InputJsonValue,
        mappedPayload: snapshotFromInput(row.mapped) as Prisma.InputJsonValue,
        status: extra.status,
        existingSnapshot: (extra.existingSnapshot ??
          null) as Prisma.InputJsonValue,
        changedFields: extra.changedFields ?? [],
        errorMessage: extra.errorMessage ?? null,
      },
    });
  }

  private toAnalyzeResult(
    importRow: {
      id: string;
      rowNumber: number;
      invoiceNumber: string;
      status: ImportRowStatus;
      existingSnapshot: unknown;
      changedFields: string[];
      invoiceId: string | null;
      errorMessage: string | null;
    },
    mapped: UpsertInvoiceInput,
    existing?: { id: string } | null,
  ): AnalyzeRowResult {
    return {
      importRowId: importRow.id,
      rowNumber: importRow.rowNumber,
      invoiceNumber: importRow.invoiceNumber,
      status: importRow.status,
      existing: (importRow.existingSnapshot as Record<string, unknown>) ?? undefined,
      incoming: snapshotFromInput(mapped),
      changedFields: importRow.changedFields,
      invoiceId: importRow.invoiceId ?? existing?.id,
      errorMessage: importRow.errorMessage ?? undefined,
    };
  }
}
