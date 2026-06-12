import { parseMoneyAmount } from "../import-row-mapper";
import type {
  ConfirmScanInvoiceInput,
  ExtractedInvoiceFields,
} from "./invoice-scan.types";

export interface ScanFieldError {
  field: string;
  message: string;
}

export function addDaysToIsoDate(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function resolveDueDate(
  extracted: Pick<ExtractedInvoiceFields, "dueDate" | "invoiceDate">,
  paymentTermsDays: number,
): string | null {
  if (extracted.dueDate && normalizeIsoDate(extracted.dueDate)) {
    return normalizeIsoDate(extracted.dueDate)!;
  }
  const invoiceDate = normalizeIsoDate(extracted.invoiceDate);
  if (invoiceDate) {
    return addDaysToIsoDate(invoiceDate, paymentTermsDays);
  }
  return null;
}

export function validateConfirmScanInput(
  input: ConfirmScanInvoiceInput,
): ScanFieldError[] {
  const errors: ScanFieldError[] = [];

  if (!input.invoiceNumber?.trim()) {
    errors.push({ field: "invoiceNumber", message: "Invoice number is required" });
  }
  if (!input.clientName?.trim()) {
    errors.push({ field: "clientName", message: "Client name is required" });
  }

  const totalAmount = parseMoneyAmount(input.totalAmount ?? "");
  if (totalAmount === undefined) {
    errors.push({
      field: "totalAmount",
      message: `Invalid total amount: ${input.totalAmount}`,
    });
  }

  const balanceDue = parseMoneyAmount(input.balanceDue ?? "");
  if (balanceDue === undefined) {
    errors.push({
      field: "balanceDue",
      message: `Invalid balance due: ${input.balanceDue}`,
    });
  }

  if (!normalizeIsoDate(input.dueDate)) {
    errors.push({ field: "dueDate", message: "Valid due date is required" });
  }

  if (input.clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.clientEmail)) {
    errors.push({ field: "clientEmail", message: "Invalid email address" });
  }

  return errors;
}

export function normalizeIsoDate(value?: string): string | undefined {
  if (!value?.trim()) {
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

export function normalizeServices(
  services?: Array<{ name: string; amount?: string }>,
): Array<{ name: string; amount?: string }> | undefined {
  if (!services?.length) {
    return undefined;
  }
  const normalized = services
    .map((service) => ({
      name: service.name.trim(),
      amount: service.amount
        ? parseMoneyAmount(service.amount) ?? service.amount.trim()
        : undefined,
    }))
    .filter((service) => service.name.length > 0);
  return normalized.length > 0 ? normalized : undefined;
}
