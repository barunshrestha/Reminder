import type { ImportResolution } from "@prisma/client";

export interface ExtractedService {
  name: string;
  amount?: string;
}

export interface ExtractedInvoiceFields {
  invoiceNumber?: string;
  clientName?: string;
  totalAmount?: string;
  balanceDue?: string;
  services?: ExtractedService[];
  invoiceDate?: string;
  dueDate?: string;
  clientEmail?: string;
  confidence: Record<string, number>;
}

export interface ScanExtractionPreview {
  scanId: string;
  filename: string;
  imageUrl: string;
  extracted: ExtractedInvoiceFields;
  suggestedDueDate: string | null;
  paymentTermsDays: number;
}

export interface ConfirmScanInvoiceInput {
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
}

export interface ConfirmScanResult {
  scanId: string;
  invoiceNumber: string;
  outcome: "inserted" | "updated" | "skipped" | "conflict";
  invoiceId?: string;
  batchId?: string;
  importRowId?: string;
  existing?: Record<string, unknown>;
  incoming?: Record<string, unknown>;
  changedFields?: string[];
}
