export type InvoiceStatus = "open" | "paid" | "closed";

export type ReminderDeliveryMode = "email" | "phone" | "document_only" | "na";

export interface InvoiceRecord {
  clientName: string;
  invoiceNumber: string;
  totalAmount: string;
  balanceDue: string;
  dueDate: string;
  dateOfService?: string | null;
  services?: Array<string | { name: string; amount?: string }>;
  clientEmail?: string | null;
  clientPhone?: string | null;
  comments?: string | null;
  sendReminder: boolean;
  externalClientId?: string | null;
  status: InvoiceStatus;
  emailOptOut: boolean;
  consentEmail: boolean;
  reminderDeliveryMode: ReminderDeliveryMode;
  lastTierSent: number | null;
  isActive: boolean;
}

export interface ContentHashInput {
  externalClientId?: string | null;
  invoiceNumber: string;
  clientName: string;
  totalAmount: string;
  balanceDue: string;
  dueDate: string;
  dateOfService?: string | null;
  services?: Array<string | { name: string; amount?: string }>;
  clientEmail?: string | null;
  clientPhone?: string | null;
  comments?: string | null;
  status: InvoiceStatus;
  emailOptOut: boolean;
  consentEmail: boolean;
  reminderDeliveryMode: ReminderDeliveryMode;
}

export interface EligibilityInput extends InvoiceRecord {
  daysBehind: number;
}

export interface EligibilityFailure {
  rule: string;
  message: string;
}
