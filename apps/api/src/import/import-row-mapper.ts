export const REQUIRED_CANONICAL_FIELDS = [
  "client_name",
  "invoice_number",
  "total_amount",
  "balance_due",
  "due_date",
] as const;

export type CanonicalField = (typeof REQUIRED_CANONICAL_FIELDS)[number] | string;

export interface MappedInvoiceRow {
  clientName: string;
  invoiceNumber: string;
  totalAmount: string;
  balanceDue: string;
  dueDate: string;
  clientEmail?: string;
  clientPhone?: string;
  externalClientId?: string;
  dateOfService?: string;
  comments?: string;
  sendReminder: boolean;
  emailOptOut: boolean;
  consentEmail: boolean;
  reminderDeliveryMode: "email" | "document_only";
}

export interface RowValidationError {
  row: number;
  field?: string;
  message: string;
}

import { normalizeHeaderKey } from "./spreadsheet-parser";

function buildColumnLookup(
  columnMap: Record<string, string>,
): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const [sourceCol, target] of Object.entries(columnMap)) {
    lookup.set(normalizeHeaderKey(sourceCol), target);
  }
  return lookup;
}

export function mapSpreadsheetRow(
  raw: Record<string, unknown>,
  columnMap: Record<string, string>,
  rowIndex: number,
): { row?: MappedInvoiceRow; errors: RowValidationError[] } {
  const errors: RowValidationError[] = [];
  const canonical: Record<string, string> = {};
  const lookup = buildColumnLookup(columnMap);

  for (const [sourceCol, value] of Object.entries(raw)) {
    const target = lookup.get(normalizeHeaderKey(sourceCol));
    if (!target) {
      continue;
    }
    canonical[target] = String(value ?? "").trim();
  }

  for (const field of REQUIRED_CANONICAL_FIELDS) {
    if (!canonical[field]) {
      errors.push({
        row: rowIndex,
        field,
        message: `Missing required field: ${field}`,
      });
    }
  }

  let mode = parseDeliveryMode(canonical.reminder_delivery_mode);
  if (!canonical.client_email) {
    mode = "document_only";
  }

  if (errors.length > 0) {
    return { errors };
  }

  const dueDate = normalizeDate(canonical.due_date);
  if (!dueDate) {
    return {
      errors: [
        {
          row: rowIndex,
          field: "due_date",
          message: "Invalid due_date",
        },
      ],
    };
  }

  const totalAmount = parseMoneyAmount(canonical.total_amount);
  if (totalAmount === undefined) {
    return {
      errors: [
        {
          row: rowIndex,
          field: "total_amount",
          message: `Invalid total_amount: ${canonical.total_amount}`,
        },
      ],
    };
  }

  const balanceDue = parseMoneyAmount(canonical.balance_due);
  if (balanceDue === undefined) {
    return {
      errors: [
        {
          row: rowIndex,
          field: "balance_due",
          message: `Invalid balance_due: ${canonical.balance_due}`,
        },
      ],
    };
  }

  return {
    row: {
      clientName: canonical.client_name,
      invoiceNumber: canonical.invoice_number,
      totalAmount,
      balanceDue,
      dueDate,
      clientEmail: canonical.client_email || undefined,
      clientPhone: canonical.client_phone || undefined,
      externalClientId: canonical.external_client_id || undefined,
      dateOfService: normalizeDate(canonical.date_of_service),
      comments: canonical.comments || undefined,
      sendReminder: parseBool(canonical.send_reminder, true),
      emailOptOut: parseBool(canonical.email_opt_out, false),
      consentEmail: parseBool(canonical.consent_email, true),
      reminderDeliveryMode: mode,
    },
    errors: [],
  };
}

function parseDeliveryMode(value?: string): "email" | "document_only" {
  const v = (value ?? "email").toLowerCase().replace(/\s+/g, "_");
  if (v === "document_only" || v === "document") {
    return "document_only";
  }
  return "email";
}

function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === "") {
    return defaultValue;
  }
  const v = value.toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

/** Strips currency symbols, commas, and accounting parentheses from spreadsheet amounts. */
export function parseMoneyAmount(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const negative = /^\(.*\)$/.test(trimmed);
  const withoutParens = trimmed.replace(/^\(|\)$/g, "").trim();
  const cleaned = withoutParens.replace(/[$€£¥,\s]/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
    return undefined;
  }
  return negative ? `-${cleaned}` : cleaned;
}

function normalizeDate(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed.toISOString().slice(0, 10);
}
