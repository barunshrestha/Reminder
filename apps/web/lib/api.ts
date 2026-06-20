const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(text || res.statusText, res.status);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return res.json() as Promise<T>;
  }
  return res.text() as Promise<T>;
}

export async function login(email: string, password: string) {
  return api<{ user: { email: string; role: string } }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function logout() {
  return api("/auth/logout", { method: "POST" });
}

export async function me() {
  return api<{ user: { email: string; role: string } }>("/auth/me");
}

export class ApiConflictError extends Error {
  constructor(
    message: string,
    public body: {
      conflict: boolean;
      existingUploadId: string;
      filename: string;
    },
  ) {
    super(message);
  }
}

async function parseResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { message: text };
  }
  if (!res.ok) {
    if (res.status === 409 && typeof json === "object" && json !== null) {
      const body = json as {
        conflict?: boolean;
        existingUploadId?: string;
        filename?: string;
        message?: string;
      };
      if (body.conflict && body.existingUploadId) {
        throw new ApiConflictError(
          body.message ?? "Upload conflict",
          {
            conflict: true,
            existingUploadId: body.existingUploadId,
            filename: body.filename ?? "",
          },
        );
      }
    }
    const message =
      typeof json === "object" &&
      json !== null &&
      "message" in json &&
      typeof (json as { message: unknown }).message === "string"
        ? (json as { message: string }).message
        : text || res.statusText;
    throw new ApiError(message, res.status);
  }
  return json as T;
}

export type MappingProfile = {
  id: string;
  name: string;
  columnMap: Record<string, string>;
};

export type SpreadsheetUploadItem = {
  id: string;
  originalFilename: string;
  createdAt: string;
  stats: {
    inserted?: number;
    updated?: number;
    skipped_unchanged?: number;
    error_count?: number;
    row_count?: number;
  } | null;
  mappingProfile: { id: string; name: string };
};

export type SpreadsheetPreview = {
  headers: string[];
  sampleRows: Record<string, string>[];
  unknownHeaders: string[];
  columnMap: Record<string, string>;
  canonicalFields: readonly string[];
};

export type ImportSpreadsheetResult = {
  uploadId: string;
  batchId: string;
  inserted: number;
  updated: number;
  skippedUnchanged: number;
  conflicts: number;
  deleted: number;
  errors: Array<{ row: number; field?: string; message: string }>;
  needsReview: boolean;
};

export type ImportRowResult = {
  importRowId: string;
  rowNumber: number;
  invoiceNumber: string;
  status: string;
  existing?: Record<string, unknown>;
  incoming: Record<string, unknown>;
  changedFields: string[];
  invoiceId?: string;
  errorMessage?: string;
};

export type AnalyzeSpreadsheetResult = {
  uploadId: string;
  batchId: string;
  status: string;
  summary: {
    new: number;
    unchanged: number;
    conflict: number;
    duplicate_in_file: number;
    error: number;
    imported: number;
  };
  rows: ImportRowResult[];
  errors: Array<{ row: number; field?: string; message: string }>;
};

export type ImportResolution = "update" | "keep" | "delete_existing";

export type PendingImportBatch = {
  id: string;
  source: string;
  status: string;
  createdAt: string;
  stats: Record<string, unknown> | null;
  connector?: { id: string; name: string } | null;
  spreadsheetUpload?: { id: string; originalFilename: string } | null;
  scanUpload?: { id: string; originalFilename: string } | null;
  _count?: { rows: number };
};

export type ImportBatchDetail = PendingImportBatch & {
  rows: Array<{
    id: string;
    rowNumber: number;
    invoiceNumber: string;
    status: string;
    existingSnapshot: Record<string, unknown> | null;
    mappedPayload: Record<string, unknown>;
    changedFields: string[];
    errorMessage: string | null;
  }>;
};

export async function listMappingProfiles() {
  return api<MappingProfile[]>("/mapping-profiles");
}

export async function updateMappingProfile(
  id: string,
  data: { columnMap?: Record<string, string> },
) {
  return api<MappingProfile>(`/mapping-profiles/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function listSpreadsheetUploads() {
  return api<SpreadsheetUploadItem[]>("/import/uploads");
}

export type DeleteUploadMode = "file_and_data" | "file_only";

export async function deleteSpreadsheetUpload(
  id: string,
  mode: DeleteUploadMode,
) {
  const params = new URLSearchParams({ mode });
  return api<{ deleted: boolean; mode: DeleteUploadMode }>(
    `/import/uploads/${id}?${params}`,
    { method: "DELETE" },
  );
}

export async function downloadImportTemplate(
  mappingProfileId: string,
  format: "xlsx" | "csv" = "xlsx",
) {
  const params = new URLSearchParams({
    mappingProfileId,
  });
  if (format === "csv") {
    params.set("format", "csv");
  }
  const res = await fetch(`${API_BASE}/import/template?${params}`, {
    credentials: "include",
  });
  if (!res.ok) {
    throw new ApiError(res.statusText, res.status);
  }
  return res.blob();
}

export async function previewSpreadsheet(
  file: File,
  options: { mappingProfileId: string; columnMap?: Record<string, string> },
) {
  const form = new FormData();
  form.append("file", file);
  form.append("mappingProfileId", options.mappingProfileId);
  if (options.columnMap) {
    form.append("columnMap", JSON.stringify(options.columnMap));
  }
  const res = await fetch(`${API_BASE}/import/preview`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  return parseResponse<SpreadsheetPreview>(res);
}

export async function analyzeSpreadsheet(
  file: File,
  options: {
    mappingProfileId: string;
    columnMap?: Record<string, string>;
    override?: boolean;
  },
) {
  const form = new FormData();
  form.append("file", file);
  form.append("mappingProfileId", options.mappingProfileId);
  if (options.columnMap) {
    form.append("columnMap", JSON.stringify(options.columnMap));
  }
  if (options.override) {
    form.append("override", "true");
  }
  const res = await fetch(`${API_BASE}/import/spreadsheet/analyze`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  return parseResponse<AnalyzeSpreadsheetResult>(res);
}

export async function commitImportBatch(
  batchId: string,
  decisions: Array<{ importRowId: string; resolution: ImportResolution }>,
) {
  return api<{
    batchId: string;
    updated: number;
    skipped: number;
    deleted: number;
    inserted: number;
    errors: Array<{ importRowId: string; message: string }>;
  }>(`/import/batches/${batchId}/commit`, {
    method: "POST",
    body: JSON.stringify({ decisions }),
  });
}

export async function listPendingImportBatches() {
  return api<PendingImportBatch[]>("/import/batches/pending");
}

export async function getImportBatch(batchId: string) {
  return api<ImportBatchDetail>(`/import/batches/${batchId}`);
}

export async function importSpreadsheet(
  file: File,
  options: {
    mappingProfileId: string;
    columnMap?: Record<string, string>;
    override?: boolean;
  },
) {
  const form = new FormData();
  form.append("file", file);
  form.append("mappingProfileId", options.mappingProfileId);
  if (options.columnMap) {
    form.append("columnMap", JSON.stringify(options.columnMap));
  }
  if (options.override) {
    form.append("override", "true");
  }
  const res = await fetch(`${API_BASE}/import/spreadsheet`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  return parseResponse<ImportSpreadsheetResult>(res);
}

export type ExtractedService = {
  name: string;
  amount?: string;
};

export type ExtractedInvoiceFields = {
  invoiceNumber?: string;
  clientName?: string;
  totalAmount?: string;
  balanceDue?: string;
  services?: ExtractedService[];
  invoiceDate?: string;
  dueDate?: string;
  clientEmail?: string;
  confidence: Record<string, number>;
};

export type ScanExtractionPreview = {
  scanId: string;
  filename: string;
  imageUrl: string;
  extracted: ExtractedInvoiceFields;
  suggestedDueDate: string | null;
  paymentTermsDays: number;
};

export type ScanExtractionBatchResult =
  | ScanExtractionPreview
  | { filename: string; ok: false; error: string };

export type ConfirmScanInvoiceInput = {
  scanId: string;
  invoiceNumber: string;
  clientName: string;
  totalAmount: string;
  balanceDue: string;
  dueDate: string;
  services?: ExtractedService[];
  clientEmail?: string;
  dateOfService?: string;
  resolution?: ImportResolution;
  batchId?: string;
  importRowId?: string;
};

export type ConfirmScanResult = {
  scanId: string;
  invoiceNumber: string;
  outcome: "inserted" | "updated" | "skipped" | "conflict";
  invoiceId?: string;
  batchId?: string;
  importRowId?: string;
  existing?: Record<string, unknown>;
  incoming?: Record<string, unknown>;
  changedFields?: string[];
};

export type InvoiceScanUploadItem = {
  id: string;
  originalFilename: string;
  createdAt: string;
  stats: Record<string, unknown> | null;
};

export function scanImageUrl(scanId: string): string {
  return `${API_BASE}/import/scan/${scanId}/image`;
}

export async function fetchScanImageBlob(scanId: string): Promise<string> {
  const res = await fetch(scanImageUrl(scanId), { credentials: "include" });
  if (!res.ok) {
    throw new ApiError(res.statusText, res.status);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function extractInvoiceScan(file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/import/scan/extract`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  return parseResponse<ScanExtractionPreview>(res);
}

export async function extractInvoiceScanBatch(files: File[]) {
  const form = new FormData();
  for (const file of files) {
    form.append("files", file);
  }
  const res = await fetch(`${API_BASE}/import/scan/extract/batch`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  return parseResponse<{ results: ScanExtractionBatchResult[] }>(res);
}

export async function confirmInvoiceScan(input: ConfirmScanInvoiceInput) {
  return api<ConfirmScanResult>("/import/scan/confirm", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function confirmInvoiceScanBatch(items: ConfirmScanInvoiceInput[]) {
  return api<{ results: Array<ConfirmScanResult | { scanId: string; ok: false; error: string }> }>(
    "/import/scan/confirm/batch",
    {
      method: "POST",
      body: JSON.stringify({ items }),
    },
  );
}

export async function listInvoiceScanUploads() {
  return api<InvoiceScanUploadItem[]>("/import/scan/history");
}

export type ReminderConfig = {
  overdueTiers: number[];
  tierPreset: "standard" | "gentle" | "custom";
  remindersEnabled: boolean;
  processingPreset: "daily" | "weekly" | "manual";
  weeklyDay: number;
  runHour: number;
  timezone: string;
  syncBeforeCheck: boolean;
  scheduleId: string;
  nextRunDescription: string;
};

export type ScheduleRun = {
  id: string;
  status: string;
  dryRun: boolean;
  stats: Record<string, unknown> | null;
  startedAt: string;
  endedAt: string | null;
};

export async function getReminderConfig() {
  return api<ReminderConfig>("/reminder-config");
}

export async function updateReminderConfig(data: Partial<ReminderConfig>) {
  return api<ReminderConfig>("/reminder-config", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function listScheduleRuns(scheduleId: string) {
  return api<ScheduleRun[]>(`/schedules/${scheduleId}/runs`);
}

export type ReminderTemplateItem = {
  tierDays: number;
  subject: string;
  bodyHtml: string;
  isCustom: boolean;
  isDefault: boolean;
};

export type ReminderTemplatesResponse = {
  templates: ReminderTemplateItem[];
  mergeFields: string[];
};

export type ReminderTemplatePreview = {
  subject: string;
  html: string;
  text: string;
  documentHtml: string;
};

export async function getReminderTemplates() {
  return api<ReminderTemplatesResponse>("/reminder-templates");
}

export async function updateReminderTemplate(
  tierDays: number,
  data: { subject: string; bodyHtml: string },
) {
  return api<ReminderTemplateItem>(`/reminder-templates/${tierDays}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function resetReminderTemplate(tierDays: number) {
  return api<ReminderTemplateItem>(`/reminder-templates/${tierDays}/reset`, {
    method: "POST",
  });
}

export async function previewReminderTemplate(data: {
  tierDays: number;
  subject: string;
  bodyHtml: string;
  invoiceNumber?: string;
}) {
  return api<ReminderTemplatePreview>("/reminder-templates/preview", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
