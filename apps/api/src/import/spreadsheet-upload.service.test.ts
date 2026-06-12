import { describe, expect, it, vi } from "vitest";
import { SpreadsheetUploadService } from "./spreadsheet-upload.service";

function createMockPrisma() {
  return {
    spreadsheetUpload: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    spreadsheetUploadInvoice: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
    },
    invoice: {
      delete: vi.fn(),
    },
  };
}

describe("SpreadsheetUploadService", () => {
  it("removes invoices only linked to the replaced upload", async () => {
    const prisma = createMockPrisma();
    prisma.spreadsheetUploadInvoice.findFirst.mockResolvedValue({
      uploadId: "upload-1",
      invoiceId: "inv-1",
      invoiceNumber: "INV-OLD",
      invoice: {
        spreadsheetUploads: [{ uploadId: "upload-1" }],
      },
    });

    const service = new SpreadsheetUploadService(prisma as never);
    const deleted = await service.removeInvoicesMissingFromReplace(
      "upload-1",
      ["INV-OLD"],
    );

    expect(deleted).toBe(1);
    expect(prisma.invoice.delete).toHaveBeenCalledWith({
      where: { id: "inv-1" },
    });
  });

  it("keeps invoices linked from multiple uploads during replace", async () => {
    const prisma = createMockPrisma();
    prisma.spreadsheetUploadInvoice.findFirst.mockResolvedValue({
      uploadId: "upload-1",
      invoiceId: "inv-2",
      invoiceNumber: "INV-SHARED",
      invoice: {
        spreadsheetUploads: [
          { uploadId: "upload-1" },
          { uploadId: "upload-2" },
        ],
      },
    });

    const service = new SpreadsheetUploadService(prisma as never);
    const deleted = await service.removeInvoicesMissingFromReplace(
      "upload-1",
      ["INV-SHARED"],
    );

    expect(deleted).toBe(0);
    expect(prisma.spreadsheetUploadInvoice.delete).toHaveBeenCalledWith({
      where: {
        uploadId_invoiceId: { uploadId: "upload-1", invoiceId: "inv-2" },
      },
    });
    expect(prisma.invoice.delete).not.toHaveBeenCalled();
  });

  it("deletes exclusive invoices when an upload is removed", async () => {
    const prisma = createMockPrisma();
    prisma.spreadsheetUpload.findUnique.mockResolvedValue({
      id: "upload-1",
      storedPath: "uploads/upload-1/file.xlsx",
      invoices: [{ uploadId: "upload-1", invoiceId: "inv-1" }],
    });
    prisma.spreadsheetUploadInvoice.count.mockResolvedValue(1);

    const service = new SpreadsheetUploadService(prisma as never);
    await service.deleteUpload("upload-1", "file_and_data");

    expect(prisma.invoice.delete).toHaveBeenCalledWith({
      where: { id: "inv-1" },
    });
    expect(prisma.spreadsheetUpload.delete).toHaveBeenCalledWith({
      where: { id: "upload-1" },
    });
  });

  it("deletes upload file only and keeps invoice data", async () => {
    const prisma = createMockPrisma();
    prisma.spreadsheetUpload.findUnique.mockResolvedValue({
      id: "upload-1",
      storedPath: "uploads/upload-1/file.xlsx",
      invoices: [{ uploadId: "upload-1", invoiceId: "inv-1" }],
    });

    const service = new SpreadsheetUploadService(prisma as never);
    await service.deleteUpload("upload-1", "file_only");

    expect(prisma.spreadsheetUploadInvoice.deleteMany).toHaveBeenCalledWith({
      where: { uploadId: "upload-1" },
    });
    expect(prisma.invoice.delete).not.toHaveBeenCalled();
    expect(prisma.spreadsheetUpload.delete).toHaveBeenCalledWith({
      where: { id: "upload-1" },
    });
  });
});
