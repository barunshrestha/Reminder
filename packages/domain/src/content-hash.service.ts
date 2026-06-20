import { createHash } from "node:crypto";
import type { ContentHashInput } from "./types";

export function normalizeServices(
  services?: Array<string | { name: string; amount?: string }>,
): Array<{ name: string; amount?: string }> {
  if (!services?.length) {
    return [];
  }
  const normalized = services.map((item) => {
    if (typeof item === "string") {
      return { name: item };
    }
    return {
      name: item.name,
      ...(item.amount !== undefined
        ? { amount: formatAmount(item.amount) }
        : {}),
    };
  });
  return normalized.sort((a, b) => a.name.localeCompare(b.name));
}

export function buildCanonicalPayload(input: ContentHashInput): Record<string, unknown> {
  return {
    external_client_id: input.externalClientId ?? null,
    invoice_number: input.invoiceNumber,
    client_name: input.clientName,
    total_amount: formatAmount(input.totalAmount),
    balance_due: formatAmount(input.balanceDue),
    due_date: input.dueDate.slice(0, 10),
    date_of_service: input.dateOfService?.slice(0, 10) ?? null,
    services: normalizeServices(input.services),
    client_email: input.clientEmail ?? null,
    client_phone: input.clientPhone ?? null,
    comments: input.comments ?? null,
    status: input.status,
    email_opt_out: input.emailOptOut,
    consent_email: input.consentEmail,
    reminder_delivery_mode: input.reminderDeliveryMode,
  };
}

export function computeContentHash(input: ContentHashInput): string {
  const normalized = buildCanonicalPayload(input);
  const json = JSON.stringify(normalized);
  return createHash("sha256").update(json).digest("hex");
}

function formatAmount(value: string): string {
  const num = Number.parseFloat(value);
  if (Number.isNaN(num)) {
    return value;
  }
  return num.toFixed(2);
}
