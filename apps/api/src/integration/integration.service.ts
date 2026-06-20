import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ImportResolution, ImportSource } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import {
  ImportAnalyzeService,
  type AnalyzeRowInput,
} from "../import/import-analyze.service";
import { ImportCommitService } from "../import/import-commit.service";
import {
  InvoiceUpsertService,
  type UpsertInvoiceInput,
} from "../invoices/invoice-upsert.service";
import { snapshotFromInvoice } from "../invoices/invoice-snapshot.util";
import { PrismaService } from "../prisma/prisma.service";
import type { BulkInvoicesDto } from "./dto/bulk-invoices.dto";
import type { PatchIntegrationInvoiceDto } from "./dto/patch-invoice.dto";
import { IdempotencyService } from "./idempotency.service";

@Injectable()
export class IntegrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analyze: ImportAnalyzeService,
    private readonly commit: ImportCommitService,
    private readonly upsert: InvoiceUpsertService,
    private readonly idempotency: IdempotencyService,
    private readonly audit: AuditService,
  ) {}

  health() {
    return {
      status: "ok",
      service: "payment-reminder-integration",
      timestamp: new Date().toISOString(),
    };
  }

  async bulkUpsert(
    dto: BulkInvoicesDto,
    apiKeyId?: string,
    idempotencyKey?: string,
  ) {
    const route = "POST /integration/invoices/bulk";
    if (idempotencyKey) {
      const cached = await this.idempotency.getCached(idempotencyKey, route);
      if (cached) {
        return cached;
      }
    }

    const analyzeRows: AnalyzeRowInput[] = [];
    for (let i = 0; i < dto.invoices.length; i++) {
      const row = dto.invoices[i]!;
      try {
        const mapped = mapIntegrationRow(row);
        analyzeRows.push({
          rowNumber: i + 1,
          rawPayload: row as unknown as Record<string, unknown>,
          mapped,
        });
      } catch (error) {
        analyzeRows.push({
          rowNumber: i + 1,
          rawPayload: row as unknown as Record<string, unknown>,
          mapped: {
            clientName: row.client_name ?? "",
            invoiceNumber: row.invoice_number ?? `__error_${i + 1}`,
            totalAmount: row.total_amount ?? "0",
            balanceDue: row.balance_due ?? "0",
            dueDate: row.due_date ?? "1970-01-01",
          },
          errorMessage:
            error instanceof Error ? error.message : "Invalid row",
        });
      }
    }

    const batchResult = await this.analyze.analyzeBatch(analyzeRows, {
      source: ImportSource.integration,
      apiKeyId,
      changeSource: "integration",
    });

    let deactivated = 0;
    let missedSyncIncrements = 0;
    if (dto.complete_sync) {
      const seen = batchResult.rows
        .filter((r) => r.status !== "conflict" && r.status !== "error")
        .map((r) => r.invoiceNumber);
      const finalize = await this.upsert.finalizeSync(seen);
      deactivated = finalize.deactivated;
      missedSyncIncrements = finalize.missedSyncIncrements;
    }

    const conflicts = batchResult.rows
      .filter((r) => r.status === "conflict")
      .map((r) => ({
        import_row_id: r.importRowId,
        invoice_number: r.invoiceNumber,
        existing: r.existing,
        incoming: r.incoming,
        changed_fields: r.changedFields,
      }));

    const response = {
      batch_id: batchResult.batchId,
      inserted: batchResult.summary.new,
      updated: 0,
      skipped_unchanged: batchResult.summary.unchanged,
      conflicts,
      errors: batchResult.rows
        .filter((r) => r.status === "error" || r.status === "duplicate_in_file")
        .map((r) => ({
          import_row_id: r.importRowId,
          invoice_number: r.invoiceNumber,
          message: r.errorMessage,
        })),
      deactivated,
      missed_sync_increments: missedSyncIncrements,
      conflicts_pending: conflicts.length,
    };

    await this.audit.record("integration.bulk_upsert", {
      ...response,
      complete_sync: dto.complete_sync ?? false,
      row_count: dto.invoices.length,
    });

    if (idempotencyKey) {
      await this.idempotency.store(idempotencyKey, route, response);
    }

    return response;
  }

  async resolveBulk(
    batchId: string,
    decisions: Array<{ import_row_id: string; resolution: ImportResolution }>,
    apiKeyId?: string,
    idempotencyKey?: string,
  ) {
    const route = `POST /integration/invoices/bulk/${batchId}/resolve`;
    if (idempotencyKey) {
      const cached = await this.idempotency.getCached(idempotencyKey, route);
      if (cached) {
        return cached;
      }
    }

    const result = await this.commit.commitBatch(
      batchId,
      decisions.map((d) => ({
        importRowId: d.import_row_id,
        resolution: d.resolution,
      })),
      { apiKeyId },
    );

    const response = {
      batch_id: batchId,
      updated: result.updated,
      skipped: result.skipped,
      deleted: result.deleted,
      inserted: result.inserted,
      errors: result.errors,
    };

    await this.audit.record("integration.bulk_resolve", response);

    if (idempotencyKey) {
      await this.idempotency.store(idempotencyKey, route, response);
    }

    return response;
  }

  async patchInvoice(
    invoiceNumber: string,
    dto: PatchIntegrationInvoiceDto,
    apiKeyId?: string,
    idempotencyKey?: string,
  ) {
    const route = `PATCH /integration/invoices/${invoiceNumber}`;
    if (idempotencyKey) {
      const cached = await this.idempotency.getCached(idempotencyKey, route);
      if (cached) {
        return cached;
      }
    }

    const existing = await this.prisma.invoice.findUnique({
      where: { invoiceNumber },
    });
    if (!existing) {
      throw new NotFoundException(`Invoice ${invoiceNumber} not found`);
    }

    const input: UpsertInvoiceInput = {
      clientName: dto.client_name ?? existing.clientName,
      invoiceNumber: existing.invoiceNumber,
      totalAmount: dto.total_amount ?? existing.totalAmount.toString(),
      balanceDue: dto.balance_due ?? existing.balanceDue.toString(),
      dueDate: dto.due_date ?? formatDate(existing.dueDate),
      clientEmail: dto.client_email ?? existing.clientEmail,
      clientPhone: dto.client_phone ?? existing.clientPhone,
      sendReminder: dto.send_reminder ?? existing.sendReminder,
      emailOptOut: dto.email_opt_out ?? existing.emailOptOut,
      consentEmail: dto.consent_email ?? existing.consentEmail,
      reminderDeliveryMode:
        dto.reminder_delivery_mode ?? existing.reminderDeliveryMode,
      status: dto.status ?? existing.status,
      externalClientId: existing.externalClientId,
      dateOfService: existing.dateOfService
        ? formatDate(existing.dateOfService)
        : null,
      comments: existing.comments,
    };

    if (
      input.reminderDeliveryMode === "email" &&
      !input.clientEmail
    ) {
      throw new BadRequestException(
        "client_email required when reminder_delivery_mode is email",
      );
    }

    const classification = this.upsert.classify(existing, input);
    if (classification === "unchanged") {
      const response = { invoice_number: invoiceNumber, outcome: "skipped" };
      if (idempotencyKey) {
        await this.idempotency.store(idempotencyKey, route, response);
      }
      return response;
    }

    const before = snapshotFromInvoice(existing);
    const { invoiceId } = await this.upsert.updateExisting(existing, input, {
      source: "integration",
      actorApiKeyId: apiKeyId,
    });

    const response = { invoice_number: invoiceNumber, outcome: "updated", invoice_id: invoiceId };

    await this.audit.record("integration.invoice_patched", {
      invoice_number: invoiceNumber,
      outcome: "updated",
      fields: Object.keys(dto),
      before,
    });

    if (idempotencyKey) {
      await this.idempotency.store(idempotencyKey, route, response);
    }

    return response;
  }
}

function mapIntegrationRow(
  row: BulkInvoicesDto["invoices"][number],
): UpsertInvoiceInput {
  const mode = row.reminder_delivery_mode ?? "email";
  if (mode === "email" && !row.client_email) {
    throw new BadRequestException(
      `client_email required for invoice ${row.invoice_number} when mode is email`,
    );
  }
  return {
    clientName: row.client_name,
    invoiceNumber: row.invoice_number,
    totalAmount: row.total_amount,
    balanceDue: row.balance_due,
    dueDate: row.due_date,
    dateOfService: row.date_of_service ?? null,
    clientEmail: row.client_email ?? null,
    clientPhone: row.client_phone ?? null,
    externalClientId: row.external_client_id ?? null,
    comments: row.comments ?? null,
    sendReminder: row.send_reminder ?? true,
    emailOptOut: row.email_opt_out ?? false,
    consentEmail: row.consent_email ?? true,
    reminderDeliveryMode: mode,
    status: row.status,
  };
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
