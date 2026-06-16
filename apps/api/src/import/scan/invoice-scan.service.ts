import {
  BadRequestException,
  Injectable,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditService } from "../../audit/audit.service";
import { InvoiceUpsertService } from "../../invoices/invoice-upsert.service";
import { PrismaService } from "../../prisma/prisma.service";
import { InvoiceExtractionService } from "./invoice-extraction.service";
import {
  normalizeIsoDate,
  normalizeServices,
  resolveDueDate,
  validateConfirmScanInput,
} from "./invoice-scan.mapper";
import { InvoiceScanUploadService } from "./invoice-scan-upload.service";
import type {
  ConfirmScanInvoiceInput,
  ConfirmScanResult,
  ScanExtractionPreview,
} from "./invoice-scan.types";
import { parseMoneyAmount } from "../import-row-mapper";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

@Injectable()
export class InvoiceScanService {
  constructor(
    private readonly extraction: InvoiceExtractionService,
    private readonly uploads: InvoiceScanUploadService,
    private readonly upsert: InvoiceUpsertService,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  async extractOne(
    buffer: Buffer,
    filename: string,
    mimeType: string,
    uploadedByUserId?: string,
  ): Promise<ScanExtractionPreview> {
    this.assertAllowedImage(mimeType, filename);

    const paymentTermsDays = await this.getPaymentTermsDays();
    const upload = await this.uploads.createPendingUpload({
      originalFilename: filename,
      mimeType,
      uploadedByUserId,
    });

    const storedPath = await this.uploads.saveFile(upload.id, filename, buffer);
    const extracted = await this.extraction.extractFromImage(buffer, mimeType);
    const suggestedDueDate = resolveDueDate(extracted, paymentTermsDays);

    await this.uploads.updateUpload(upload.id, {
      storedPath,
      extractionJson: extracted as unknown as Prisma.InputJsonValue,
    });

    await this.audit.record("import.scan.extract", {
      scan_id: upload.id,
      filename,
    });

    return {
      scanId: upload.id,
      filename,
      imageUrl: `/api/v1/import/scan/${upload.id}/image`,
      extracted,
      suggestedDueDate,
      paymentTermsDays,
    };
  }

  async extractBatch(
    files: Array<{ buffer: Buffer; filename: string; mimeType: string }>,
    uploadedByUserId?: string,
  ): Promise<{ results: Array<ScanExtractionPreview | { filename: string; ok: false; error: string }> }> {
    const results: Array<
      ScanExtractionPreview | { filename: string; ok: false; error: string }
    > = [];

    for (const file of files) {
      try {
        const preview = await this.extractOne(
          file.buffer,
          file.filename,
          file.mimeType,
          uploadedByUserId,
        );
        results.push(preview);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Extraction failed";
        results.push({
          filename: file.filename,
          ok: false,
          error: message,
        });
      }
    }

    return { results };
  }

  async confirmOne(
    input: ConfirmScanInvoiceInput,
    uploadedByUserId?: string,
  ): Promise<ConfirmScanResult> {
    const errors = validateConfirmScanInput(input);
    if (errors.length > 0) {
      throw new BadRequestException({ message: "Validation failed", errors });
    }

    const upload = await this.uploads.findById(input.scanId);
    if (upload.confirmedFields) {
      throw new BadRequestException("This scan has already been imported");
    }

    const totalAmount = parseMoneyAmount(input.totalAmount)!;
    const balanceDue = parseMoneyAmount(input.balanceDue)!;
    const dueDate = normalizeIsoDate(input.dueDate)!;
    const services = normalizeServices(input.services);
    const clientEmail = input.clientEmail?.trim() || undefined;
    const dateOfService = normalizeIsoDate(input.dateOfService) ?? null;

    const { outcome, invoiceId } = await this.upsert.upsertOne({
      clientName: input.clientName.trim(),
      invoiceNumber: input.invoiceNumber.trim(),
      totalAmount,
      balanceDue,
      dueDate,
      dateOfService,
      services,
      clientEmail: clientEmail ?? null,
      reminderDeliveryMode: clientEmail ? "email" : "document_only",
      comments: `Imported from scan ${upload.id}`,
    });

    await this.uploads.updateUpload(upload.id, {
      confirmedFields: input as unknown as Prisma.InputJsonValue,
      stats: {
        outcome,
        invoice_number: input.invoiceNumber.trim(),
      },
      uploadedBy: uploadedByUserId
        ? { connect: { id: uploadedByUserId } }
        : undefined,
    });

    await this.uploads.linkInvoice(
      upload.id,
      invoiceId,
      input.invoiceNumber.trim(),
    );

    await this.audit.record("import.scan.confirm", {
      scan_id: upload.id,
      invoice_id: invoiceId,
      invoice_number: input.invoiceNumber.trim(),
      outcome,
    });

    return {
      scanId: upload.id,
      invoiceId,
      invoiceNumber: input.invoiceNumber.trim(),
      outcome,
    };
  }

  async confirmBatch(
    items: ConfirmScanInvoiceInput[],
    uploadedByUserId?: string,
  ): Promise<{ results: Array<ConfirmScanResult | { scanId: string; ok: false; error: string }> }> {
    const results: Array<
      ConfirmScanResult | { scanId: string; ok: false; error: string }
    > = [];

    for (const item of items) {
      try {
        const result = await this.confirmOne(item, uploadedByUserId);
        results.push(result);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Confirm failed";
        results.push({
          scanId: item.scanId,
          ok: false,
          error: message,
        });
      }
    }

    return { results };
  }

  listUploads() {
    return this.uploads.listUploads();
  }

  async getImageStream(scanId: string) {
    const upload = await this.uploads.findById(scanId);
    if (!upload.storedPath) {
      throw new BadRequestException("Scan image is not available");
    }
    return {
      stream: this.uploads.createReadStream(upload.storedPath),
      mimeType: upload.mimeType,
      filename: upload.originalFilename,
    };
  }

  private async getPaymentTermsDays(): Promise<number> {
    const settings = await this.prisma.vendorSettings.findFirst({
      where: { id: "default" },
      select: { defaultPaymentTermsDays: true },
    });
    return settings?.defaultPaymentTermsDays ?? 30;
  }

  private assertAllowedImage(mimeType: string, filename: string): void {
    const normalizedMime = mimeType.toLowerCase();
    if (ALLOWED_MIME_TYPES.has(normalizedMime)) {
      return;
    }
    if (/\.(jpe?g|png|webp|gif)$/i.test(filename)) {
      return;
    }
    throw new BadRequestException(
      "Only image files are supported (JPEG, PNG, WebP, GIF)",
    );
  }
}
