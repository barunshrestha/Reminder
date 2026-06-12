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
}
