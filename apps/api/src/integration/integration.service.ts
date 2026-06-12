import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import {
  InvoiceUpsertService,
  type UpsertInvoiceInput,
} from "../invoices/invoice-upsert.service";
import { PrismaService } from "../prisma/prisma.service";
import type { BulkInvoicesDto } from "./dto/bulk-invoices.dto";
import type { PatchIntegrationInvoiceDto } from "./dto/patch-invoice.dto";
import { IdempotencyService } from "./idempotency.service";

@Injectable()
export class IntegrationService {
  constructor(
    private readonly prisma: PrismaService,
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
    idempotencyKey?: string,
  ) {
    const route = "POST /integration/invoices/bulk";
    if (idempotencyKey) {
      const cached = await this.idempotency.getCached(idempotencyKey, route);
      if (cached) {
        return cached;
      }
    }

    const inputs = dto.invoices.map((row) => mapIntegrationRow(row));
    const result = await this.upsert.upsertBatch(inputs, {
      completeSync: dto.complete_sync ?? false,
    });

    const response = {
      inserted: result.inserted,
      updated: result.updated,
      skipped_unchanged: result.skippedUnchanged,
      deactivated: result.deactivated,
      missed_sync_increments: result.missedSyncIncrements,
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

  async patchInvoice(
    invoiceNumber: string,
    dto: PatchIntegrationInvoiceDto,
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

    const { outcome } = await this.upsert.upsertOne(input);
    const response = { invoice_number: invoiceNumber, outcome };

    await this.audit.record("integration.invoice_patched", {
      invoice_number: invoiceNumber,
      outcome,
      fields: Object.keys(dto),
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
