export type InvoiceColumnId =
  | "invoice"
  | "client"
  | "email"
  | "phone"
  | "balance"
  | "due"
  | "status"
  | "notification"
  | "deliveryMode"
  | "lastTier"
  | "lastReminder"
  | "paidAt"
  | "comment"
  | "reminder"
  | "optOut"
  | "sendEmail";

export type InvoiceColumnDef = {
  id: InvoiceColumnId;
  label: string;
  defaultVisible: boolean;
};

export const INVOICE_COLUMNS: InvoiceColumnDef[] = [
  { id: "invoice", label: "Invoice#", defaultVisible: true },
  { id: "client", label: "Client", defaultVisible: true },
  { id: "balance", label: "Balance", defaultVisible: true },
  { id: "due", label: "Due", defaultVisible: true },
  { id: "status", label: "Status", defaultVisible: true },
  { id: "notification", label: "Notification", defaultVisible: true },
  { id: "reminder", label: "Reminder", defaultVisible: true },
  { id: "deliveryMode", label: "Delivery mode", defaultVisible: true },
  { id: "comment", label: "Comment", defaultVisible: true },
  { id: "email", label: "Email", defaultVisible: false },
  { id: "phone", label: "Phone", defaultVisible: false },
  { id: "lastTier", label: "Last tier", defaultVisible: false },
  { id: "lastReminder", label: "Last reminder", defaultVisible: false },
  { id: "paidAt", label: "Paid at", defaultVisible: false },
  { id: "optOut", label: "Opt-out", defaultVisible: false },
  { id: "sendEmail", label: "Send email", defaultVisible: false },
];

export const DEFAULT_VISIBLE_COLUMNS: InvoiceColumnId[] = INVOICE_COLUMNS.filter(
  (column) => column.defaultVisible,
).map((column) => column.id);

export const INVOICE_COLUMN_STORAGE_KEY = "invoice-grid-visible-columns";

export function loadVisibleColumns(): InvoiceColumnId[] {
  if (typeof window === "undefined") {
    return DEFAULT_VISIBLE_COLUMNS;
  }
  try {
    const raw = localStorage.getItem(INVOICE_COLUMN_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_VISIBLE_COLUMNS;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return DEFAULT_VISIBLE_COLUMNS;
    }
    const valid = new Set(INVOICE_COLUMNS.map((column) => column.id));
    const columns = parsed.filter(
      (id): id is InvoiceColumnId =>
        typeof id === "string" && valid.has(id as InvoiceColumnId),
    );
    return columns.length > 0 ? columns : DEFAULT_VISIBLE_COLUMNS;
  } catch {
    return DEFAULT_VISIBLE_COLUMNS;
  }
}

export function saveVisibleColumns(columns: InvoiceColumnId[]) {
  localStorage.setItem(INVOICE_COLUMN_STORAGE_KEY, JSON.stringify(columns));
}
