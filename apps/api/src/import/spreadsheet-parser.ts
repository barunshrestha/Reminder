import { BadRequestException } from "@nestjs/common";
import * as XLSX from "xlsx";

export function assertSupportedExtension(filename: string): void {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (!["xlsx", "xls", "csv"].includes(ext ?? "")) {
    throw new BadRequestException(
      "Unsupported file type. Use .xlsx, .xls, or .csv",
    );
  }
}

export function readSpreadsheetWorkbook(buffer: Buffer): XLSX.WorkBook {
  return XLSX.read(buffer, { type: "buffer", cellDates: true });
}

export function parseSpreadsheetRows(
  buffer: Buffer,
  filename: string,
): Record<string, unknown>[] {
  assertSupportedExtension(filename);
  const workbook = readSpreadsheetWorkbook(buffer);
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new BadRequestException("Spreadsheet has no sheets");
  }
  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
  const dataRows = json.filter((row) => rowHasValues(row));
  if (dataRows.length === 0) {
    throw new BadRequestException("Spreadsheet has no data rows");
  }
  return dataRows;
}

function rowHasValues(row: Record<string, unknown>): boolean {
  return Object.values(row).some((value) => String(value ?? "").trim() !== "");
}

export function extractHeaders(
  buffer: Buffer,
  filename: string,
): string[] {
  assertSupportedExtension(filename);
  const workbook = readSpreadsheetWorkbook(buffer);
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new BadRequestException("Spreadsheet has no sheets");
  }
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as string[][];
  const headerRow = rows[0];
  if (!headerRow?.length) {
    throw new BadRequestException("Spreadsheet has no header row");
  }
  return headerRow.map((h) => normalizeHeaderKey(String(h ?? ""))).filter(Boolean);
}

export function normalizeHeaderKey(key: string): string {
  return key.replace(/^\uFEFF/, "").trim();
}

export function extractSampleRows(
  buffer: Buffer,
  filename: string,
  limit = 5,
): Record<string, string>[] {
  const headers = extractHeaders(buffer, filename);
  assertSupportedExtension(filename);
  const workbook = readSpreadsheetWorkbook(buffer);
  const sheet = workbook.Sheets[workbook.SheetNames[0]!];
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as string[][];
  const samples: Record<string, string>[] = [];
  for (let i = 1; i < rows.length && samples.length < limit; i++) {
    const row = rows[i];
    if (!row?.some((c) => String(c ?? "").trim())) {
      continue;
    }
    const record: Record<string, string> = {};
    headers.forEach((header, idx) => {
      record[header] = String(row[idx] ?? "").trim();
    });
    samples.push(record);
  }
  return samples;
}

export const CANONICAL_IMPORT_FIELDS = [
  "client_name",
  "invoice_number",
  "total_amount",
  "balance_due",
  "due_date",
  "client_email",
  "client_phone",
  "external_client_id",
  "date_of_service",
  "comments",
  "send_reminder",
  "email_opt_out",
  "consent_email",
  "reminder_delivery_mode",
  "status",
] as const;

export function findUnknownHeaders(
  headers: string[],
  columnMap: Record<string, string>,
): string[] {
  const mappedSources = new Set(Object.keys(columnMap));
  return headers.filter((h) => !mappedSources.has(h));
}
