import type { Invoice } from "@prisma/client";
import type { UpsertInvoiceInput } from "./invoice-upsert.service";

export type InvoiceSnapshot = Record<string, unknown>;

export function snapshotFromInvoice(invoice: Invoice): InvoiceSnapshot {
  return {
    id: invoice.id,
    client_name: invoice.clientName,
    invoice_number: invoice.invoiceNumber,
    total_amount: invoice.totalAmount.toString(),
    balance_due: invoice.balanceDue.toString(),
    due_date: invoice.dueDate.toISOString().slice(0, 10),
    date_of_service: invoice.dateOfService
      ? invoice.dateOfService.toISOString().slice(0, 10)
      : null,
    services: invoice.services,
    client_email: invoice.clientEmail,
    client_phone: invoice.clientPhone,
    comments: invoice.comments,
    send_reminder: invoice.sendReminder,
    external_client_id: invoice.externalClientId,
    status: invoice.status,
    email_opt_out: invoice.emailOptOut,
    consent_email: invoice.consentEmail,
    reminder_delivery_mode: invoice.reminderDeliveryMode,
    content_hash: invoice.contentHash,
    is_active: invoice.isActive,
  };
}

export function snapshotFromInput(input: UpsertInvoiceInput): InvoiceSnapshot {
  return {
    client_name: input.clientName,
    invoice_number: input.invoiceNumber,
    total_amount: input.totalAmount,
    balance_due: input.balanceDue,
    due_date: input.dueDate,
    date_of_service: input.dateOfService ?? null,
    services: input.services ?? null,
    client_email: input.clientEmail ?? null,
    client_phone: input.clientPhone ?? null,
    comments: input.comments ?? null,
    send_reminder: input.sendReminder ?? true,
    external_client_id: input.externalClientId ?? null,
    status: input.status ?? "open",
    email_opt_out: input.emailOptOut ?? false,
    consent_email: input.consentEmail ?? true,
    reminder_delivery_mode: input.reminderDeliveryMode ?? "email",
  };
}

const TRACKED_FIELDS = [
  "client_name",
  "total_amount",
  "balance_due",
  "due_date",
  "date_of_service",
  "client_email",
  "client_phone",
  "comments",
  "send_reminder",
  "external_client_id",
  "status",
  "email_opt_out",
  "consent_email",
  "reminder_delivery_mode",
] as const;

export function diffSnapshots(
  existing: InvoiceSnapshot,
  incoming: InvoiceSnapshot,
): string[] {
  const changed: string[] = [];
  for (const field of TRACKED_FIELDS) {
    const a = JSON.stringify(existing[field] ?? null);
    const b = JSON.stringify(incoming[field] ?? null);
    if (a !== b) {
      changed.push(field);
    }
  }
  return changed;
}
