import { BadRequestException, Injectable } from "@nestjs/common";
import { ImportSource } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { MappingProfilesService } from "../mapping-profiles/mapping-profiles.service";
import {
  mapSpreadsheetRow,
  type RowValidationError,
} from "./import-row-mapper";
import {
  ImportAnalyzeService,
  type AnalyzeBatchResult,
} from "./import-analyze.service";
import {
  ImportCommitService,
  type CommitDecision,
  type CommitResult,
} from "./import-commit.service";
import { parseSpreadsheetRows } from "./spreadsheet-parser";
import { SpreadsheetUploadService } from "./spreadsheet-upload.service";
import { UploadConflictException } from "./upload-conflict.exception";

export interface AnalyzeSpreadsheetResult extends AnalyzeBatchResult {
  uploadId: string;
  errors: RowValidationError[];
}

export interface ImportResult {
  uploadId: string;
  batchId: string;
  inserted: number;
  updated: number;
  skippedUnchanged: number;
  conflicts: number;
  deleted: number;
  errors: RowValidationError[];
  needsReview: boolean;
}

@Injectable()
export class ImportService {
  constructor(
    private readonly analyze: ImportAnalyzeService,
    private readonly commit: ImportCommitService,
    private readonly mappingProfiles: MappingProfilesService,
    private readonly audit: AuditService,
    private readonly uploads: SpreadsheetUploadService,
  ) {}

  async analyzeSpreadsheet(
    buffer: Buffer,
    filename: string,
    options: {
      mappingProfileId?: string;
      columnMap?: Record<string, string>;
      override?: boolean;
      uploadedByUserId?: string;
    },
  ): Promise<AnalyzeSpreadsheetResult> {
    const mappingProfileId = await this.resolveMappingProfileId(options);
    const columnMap = await this.resolveColumnMap(options);
    const existing = await this.uploads.findByFilename(filename);

    if (existing && !options.override) {
      throw new UploadConflictException(existing.id, filename);
    }

    const rows = parseSpreadsheetRows(buffer, filename);
    const { analyzeRows, errors } = this.mapRows(rows, columnMap);

    let uploadId: string;
    if (existing && options.override) {
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
        uploadedBy: options.uploadedByUserId
          ? { connect: { id: options.uploadedByUserId } }
          : undefined,
      });
      uploadId = existing.id;
    } else {
      const upload = await this.uploads.createUpload({
        originalFilename: filename,
        storedPath: "",
        mappingProfileId,
        columnMapSnapshot: columnMap,
        stats: {},
        uploadedByUserId: options.uploadedByUserId,
      });
      const storedPath = await this.uploads.saveFile(
        upload.id,
        filename,
        buffer,
      );
      await this.uploads.updateUpload(upload.id, { storedPath });
      uploadId = upload.id;
    }

    const batchResult = await this.analyze.analyzeBatch(analyzeRows, {
      source: ImportSource.spreadsheet,
      spreadsheetUploadId: uploadId,
      createdByUserId: options.uploadedByUserId,
      changeSource: "import.spreadsheet",
    });

    await this.linkImportedRows(uploadId, batchResult.batchId);

    await this.uploads.updateUpload(uploadId, {
      stats: {
        batch_id: batchResult.batchId,
        ...batchResult.summary,
        error_count: errors.length,
        row_count: rows.length,
      },
    });

    await this.audit.record("import.spreadsheet.analyze", {
      upload_id: uploadId,
      batch_id: batchResult.batchId,
      filename,
      ...batchResult.summary,
      error_count: errors.length,
    });

    return {
      ...batchResult,
      uploadId,
      errors,
    };
  }

  async commitSpreadsheetBatch(
    batchId: string,
    decisions: CommitDecision[],
    userId?: string,
  ): Promise<CommitResult> {
    const result = await this.commit.commitBatch(batchId, decisions, {
      userId,
    });

    const batch = await this.analyze.getBatch(batchId);
    if (batch.spreadsheetUploadId) {
      await this.linkImportedRows(batch.spreadsheetUploadId, batchId);
    }

    await this.audit.record("import.spreadsheet.commit", {
      batch_id: batchId,
      ...result,
    });

    return result;
  }

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
    const analyzed = await this.analyzeSpreadsheet(buffer, filename, options);

    return {
      uploadId: analyzed.uploadId,
      batchId: analyzed.batchId,
      inserted: analyzed.summary.new,
      updated: 0,
      skippedUnchanged: analyzed.summary.unchanged,
      conflicts: analyzed.summary.conflict,
      deleted: 0,
      errors: analyzed.errors,
      needsReview: analyzed.summary.conflict > 0,
    };
  }

  getBatch(batchId: string) {
    return this.analyze.getBatch(batchId);
  }

  listPendingBatches() {
    return this.analyze.listPendingBatches();
  }

  private mapRows(
    rows: Record<string, unknown>[],
    columnMap: Record<string, string>,
  ) {
    const analyzeRows: Array<{
      rowNumber: number;
      rawPayload: Record<string, unknown>;
      mapped: import("./import-analyze.service").AnalyzeRowInput["mapped"];
      errorMessage?: string;
    }> = [];
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
        analyzeRows.push({
          rowNumber: rowIndex,
          rawPayload: rows[i],
          mapped: {
            clientName: "",
            invoiceNumber: `__error_${rowIndex}`,
            totalAmount: "0",
            balanceDue: "0",
            dueDate: "1970-01-01",
          },
          errorMessage: rowErrors.map((e) => e.message).join("; "),
        });
        continue;
      }
      if (!row) {
        continue;
      }
      analyzeRows.push({
        rowNumber: rowIndex,
        rawPayload: rows[i],
        mapped: row,
      });
    }

    return { analyzeRows, errors };
  }

  private async linkImportedRows(uploadId: string, batchId: string) {
    const batch = await this.analyze.getBatch(batchId);
    const links = batch.rows
      .filter(
        (row) =>
          row.invoiceId &&
          (row.status === "imported" ||
            row.status === "unchanged" ||
            row.status === "deleted"),
      )
      .map((row) => ({
        invoiceId: row.invoiceId!,
        invoiceNumber: row.invoiceNumber,
        importRowId: row.id,
      }));

    await this.uploads.linkInvoices(uploadId, links);
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
