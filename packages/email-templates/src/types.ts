export interface ReminderTemplateData {
  clientName: string;
  invoiceNumber: string;
  totalAmount: string;
  balanceDue: string;
  dueDate: string;
  dateOfService?: string | null;
  services?: Array<string | { name: string; amount?: string }>;
  daysBehind: number;
  notificationNumber: number;
  comments?: string | null;
  vendorName?: string;
  vendorPhysicalAddress?: string | null;
  includeComments?: boolean;
  unsubscribeUrl?: string;
  tier?: number;
}

export interface MilestoneTemplateContent {
  subject: string;
  bodyHtml: string;
}

export type MergeFieldContext = ReminderTemplateData & { tier: number };

export const MERGE_FIELDS = [
  "client_name",
  "invoice_number",
  "balance_due",
  "total_amount",
  "due_date",
  "days_behind",
  "tier",
  "vendor_name",
  "date_of_service",
] as const;
