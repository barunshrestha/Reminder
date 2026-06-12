import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { InvoiceUpsertService } from "../invoices/invoice-upsert.service";
import { MappingProfilesService } from "../mapping-profiles/mapping-profiles.service";
import {
  mapSpreadsheetRow,
  type RowValidationError,
} from "./import-row-mapper";
import { parseSpreadsheetRows } from "./spreadsheet-parser";
import { SpreadsheetUploadService } from "./spreadsheet-upload.service";
import { UploadConflictException } from "./upload-conflict.exception";

export interface ImportResult {
  uploadId: string;
  inserted: number;
  updated: number;
  skippedUnchanged: number;
  deleted: number;
  errors: RowValidationError[];
}

interface ImportRowOutcome {
  invoiceId: string;
  invoiceNumber: string;
  outcome: "inserted" | "updated" | "skipped";
}

@Injectable()
export class ImportService {
  constructor(
    private readonly upsert: InvoiceUpsertService,
    private readonly mappingProfiles: MappingProfilesService,
    private readonly audit: AuditService,
    private readonly uploads: SpreadsheetUploadService,
  ) {}

  async importFile(
    buffer: Buffer,
    filename: string,
    options: {
      mappingProfileId?: string;
      columnMap?: Record<string, string>;
      override?: boolean;
      uploadedByUserId?: string;
    },
  ): Promise<ImportResult> {
    const mappingProfileId = await this.resolveMappingProfileId(options);
    const columnMap = await this.resolveColumnMap(options);
    const existing = await this.uploads.findByFilename(filename);

    if (existing && !options.override) {
      throw new UploadConflictException(existing.id, filename);
    }

    const rows = parseSpreadsheetRows(buffer, filename);
    const rowOutcomes = await this.importRows(rows, columnMap);

    const result: ImportResult = {
      uploadId: "",
      inserted: 0,
      updated: 0,
      skippedUnchanged: 0,
      deleted: 0,
      errors: rowOutcomes.errors,
    };

    for (const outcome of rowOutcomes.successes) {
      if (outcome.outcome === "inserted") {
        result.inserted++;
      } else if (outcome.outcome === "updated") {
        result.updated++;
      } else {
        result.skippedUnchanged++;
      }
    }

    const newInvoiceNumbers = new Set(
      rowOutcomes.successes.map((row) => row.invoiceNumber),
    );
    const stats = {
      inserted: result.inserted,
      updated: result.updated,
      skipped_unchanged: result.skippedUnchanged,
      error_count: result.errors.length,
      row_count: rows.length,
    };

    if (existing && options.override) {
      const oldNumbers = await this.uploads.getLinkedInvoiceNumbers(existing.id);
      const missing = [...oldNumbers].filter((n) => !newInvoiceNumbers.has(n));
      result.deleted = await this.uploads.removeInvoicesMissingFromReplace(
        existing.id,
        missing,
      );

      await this.uploads.deleteStoredFile(existing.storedPath);
      const storedPath = await this.uploads.saveFile(
        existing.id,
        filename,
        buffer,
      );

      await this.uploads.updateUpload(existing.id, {
        storedPath,
        mappingProfile: { connect: { id: mappingProfileId } },
        columnMapSnapshot: columnMap,
        stats: stats as Prisma.InputJsonValue,
        uploadedBy: options.uploadedByUserId
          ? { connect: { id: options.uploadedByUserId } }
          : undefined,
      });

      await this.uploads.linkInvoices(
        existing.id,
        rowOutcomes.successes.map((row) => ({
          invoiceId: row.invoiceId,
          invoiceNumber: row.invoiceNumber,
        })),
      );

      result.uploadId = existing.id;
    } else {
      const upload = await this.uploads.createUpload({
        originalFilename: filename,
        storedPath: "",
        mappingProfileId,
        columnMapSnapshot: columnMap,
        stats,
        uploadedByUserId: options.uploadedByUserId,
      });

      const storedPath = await this.uploads.saveFile(
        upload.id,
        filename,
        buffer,
      );

      await this.uploads.updateUpload(upload.id, { storedPath });
      await this.uploads.linkInvoices(
        upload.id,
        rowOutcomes.successes.map((row) => ({
          invoiceId: row.invoiceId,
          invoiceNumber: row.invoiceNumber,
        })),
      );

      result.uploadId = upload.id;
    }

    await this.audit.record("import.spreadsheet", {
      upload_id: result.uploadId,
      filename,
      override: Boolean(options.override),
      inserted: result.inserted,
      updated: result.updated,
      skipped_unchanged: result.skippedUnchanged,
      deleted_count: result.deleted,
      error_count: result.errors.length,
    });

    return result;
  }

  private async importRows(
    rows: Record<string, unknown>[],
    columnMap: Record<string, string>,
  ): Promise<{
    successes: ImportRowOutcome[];
    errors: RowValidationError[];
  }> {
    const successes: ImportRowOutcome[] = [];
    const errors: RowValidationError[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowIndex = i + 2;
      const { row, errors: rowErrors } = mapSpreadsheetRow(
        rows[i],
        columnMap,
        rowIndex,
      );
      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
        continue;
      }
      if (!row) {
        continue;
      }

      const { outcome, invoiceId } = await this.upsert.upsertOne({
        clientName: row.clientName,
        invoiceNumber: row.invoiceNumber,
        totalAmount: row.totalAmount,
        balanceDue: row.balanceDue,
        dueDate: row.dueDate,
        dateOfService: row.dateOfService ?? null,
        clientEmail: row.clientEmail ?? null,
        comments: row.comments ?? null,
        sendReminder: row.sendReminder,
        externalClientId: row.externalClientId ?? null,
        emailOptOut: row.emailOptOut,
        consentEmail: row.consentEmail,
        reminderDeliveryMode: row.reminderDeliveryMode,
      });

      successes.push({
        invoiceId,
        invoiceNumber: row.invoiceNumber,
        outcome,
      });
    }

    return { successes, errors };
  }

  private async resolveMappingProfileId(options: {
    mappingProfileId?: string;
    columnMap?: Record<string, string>;
  }): Promise<string> {
    if (options.mappingProfileId) {
      return options.mappingProfileId;
    }
    throw new BadRequestException(
      "mappingProfileId is required for spreadsheet import",
    );
  }

  private async resolveColumnMap(options: {
    mappingProfileId?: string;
    columnMap?: Record<string, string>;
  }): Promise<Record<string, string>> {
    if (options.columnMap) {
      return options.columnMap;
    }
    if (options.mappingProfileId) {
      const profile = await this.mappingProfiles.findOne(
        options.mappingProfileId,
      );
      return profile.columnMap as Record<string, string>;
    }
    throw new BadRequestException(
      "Provide mappingProfileId or columnMap in request body",
    );
  }
}
