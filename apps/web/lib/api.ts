const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";

const TENANT_ID_KEY = "active_tenant_id";
const TENANT_SLUG_KEY = "active_tenant_slug";

export function getStoredTenantId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TENANT_ID_KEY);
}

export function setStoredTenant(tenantId: string, slug?: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TENANT_ID_KEY, tenantId);
  if (slug) {
    localStorage.setItem(TENANT_SLUG_KEY, slug);
  }
}

export function clearStoredTenant() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TENANT_ID_KEY);
  localStorage.removeItem(TENANT_SLUG_KEY);
  tenantSyncedFromSession = false;
}

function tenantHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const tenantId = getStoredTenantId();
  const tenantSlug =
    typeof window === "undefined"
      ? null
      : localStorage.getItem(TENANT_SLUG_KEY);
  if (tenantId) headers["x-tenant-id"] = tenantId;
  if (tenantSlug) headers["x-tenant-slug"] = tenantSlug;
  return headers;
}

let tenantBootstrap: Promise<void> | null = null;
let tenantSyncedFromSession = false;

async function ensureTenantHeaders(): Promise<void> {
  if (typeof window === "undefined" || tenantSyncedFromSession) {
    return;
  }
  if (!tenantBootstrap) {
    tenantBootstrap = fetch(`${API_BASE}/auth/me`, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then(async (res) => {
        if (!res.ok) {
          return;
        }
        const result = (await res.json()) as {
          user: { tenantId?: string; tenantSlug?: string };
        };
        if (result.user.tenantId) {
          setStoredTenant(result.user.tenantId, result.user.tenantSlug);
        }
        tenantSyncedFromSession = true;
      })
      .catch(() => undefined)
      .finally(() => {
        tenantBootstrap = null;
      });
  }
  await tenantBootstrap;
}

function skipsTenantBootstrap(path: string): boolean {
  return (
    path === "/auth/login" ||
    path === "/auth/register" ||
    path === "/auth/config" ||
    path.startsWith("/auth/oidc")
  );
}

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
  if (typeof window !== "undefined" && !skipsTenantBootstrap(path)) {
    await ensureTenantHeaders();
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...tenantHeaders(),
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

export async function login(email: string, password: string, tenantId?: string) {
  const result = await api<{
    user: { email: string };
    tenantId?: string;
    tenantSlug?: string;
    mfaRequired?: boolean;
  }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password, tenant_id: tenantId }),
  });
  if (result.tenantId) {
    setStoredTenant(result.tenantId, result.tenantSlug);
    tenantSyncedFromSession = true;
  }
  return result;
}

export async function logout() {
  clearStoredTenant();
  return api("/auth/logout", { method: "POST" });
}

export async function me() {
  return api<{
    user: {
      email: string;
      role?: "admin" | "operator";
      tenantId?: string;
      tenantSlug?: string;
    };
  }>("/auth/me");
}

export async function listMyTenants() {
  return api<
    Array<{
      tenantId: string;
      role: string;
      tenant: { id: string; name: string; slug: string; subdomain: string };
    }>
  >("/accounts/tenants");
}

export async function onboardAccount(data: {
  account_name: string;
  tenant_name: string;
  subdomain: string;
  plan_code?: string;
}) {
  return api<{ tenantId: string; slug: string; subdomain: string }>(
    "/accounts/onboard",
    { method: "POST", body: JSON.stringify(data) },
  );
}

export async function getBillingSubscription() {
  return api("/billing/subscription");
}

export async function getBillingUsage() {
  return api("/billing/usage");
}

export type VendorSettings = {
  timezone: string;
  vendorName: string | null;
  vendorPhysicalAddress: string | null;
  digestEmailEnabled: boolean;
  fromEmail: string | null;
  fromName: string | null;
  replyToEmail: string | null;
  emailVerifiedAt: string | null;
};

export async function getVendorSettings() {
  return api<VendorSettings>("/vendor-settings");
}

export async function updateVendorSettings(data: {
  timezone?: string;
  vendor_name?: string | null;
  vendor_physical_address?: string | null;
  digest_email_enabled?: boolean;
  from_email?: string | null;
  from_name?: string | null;
  reply_to_email?: string | null;
}) {
  return api<VendorSettings>("/vendor-settings", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function sendTestVendorEmail(to?: string) {
  return api<{ ok: boolean; to: string; providerMessageId?: string }>(
    "/vendor-settings/test-email",
    {
      method: "POST",
      body: JSON.stringify(to ? { to } : {}),
    },
  );
}

export async function sendInvoiceEmail(invoiceNumber: string) {
  return api<{
    ok: boolean;
    to: string;
    tier: number;
    providerMessageId?: string;
    invoice: InvoiceListItem;
  }>(`/invoices/${encodeURIComponent(invoiceNumber)}/send-email`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export type InvoiceListItem = {
  invoiceNumber: string;
  clientName: string;
  balanceDue: string;
  dueDate: string;
  status: string;
  sendReminder: boolean;
  emailOptOut: boolean;
  clientEmail?: string | null;
  clientPhone?: string | null;
  notificationNumber: number;
  reminderDeliveryMode: "email" | "phone" | "document_only" | "na";
  lastTierSent?: number | null;
  lastReminderSentAt?: string | null;
  paidAt?: string | null;
  comments?: string | null;
};

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

export type AuthConfig = {
  oidcEnabled: boolean;
  passwordLoginEnabled: boolean;
};

export async function getAuthConfig() {
  return api<AuthConfig>("/auth/config");
}

export function ssoLoginUrl() {
  return `${API_BASE}/auth/oidc/login`;
}

export type NotificationPreferences = {
  pushEnabled: boolean;
  importFailures: boolean;
  reminderRunFailures: boolean;
  pushConfigured: boolean;
  subscriptionCount: number;
};

export async function getVapidPublicKey() {
  return api<{ publicKey: string | null }>("/notifications/vapid-public-key");
}

export async function getNotificationPreferences() {
  return api<NotificationPreferences>("/notifications/preferences");
}

export async function updateNotificationPreferences(
  data: Partial<
    Pick<
      NotificationPreferences,
      "pushEnabled" | "importFailures" | "reminderRunFailures"
    >
  >,
) {
  return api<NotificationPreferences>("/notifications/preferences", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function subscribePush(input: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}) {
  return api<{ ok: boolean }>("/notifications/push-subscribe", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function unsubscribePush(input: { endpoint?: string }) {
  return api<{ ok: boolean }>("/notifications/push-subscribe", {
    method: "DELETE",
    body: JSON.stringify(input),
  });
}
