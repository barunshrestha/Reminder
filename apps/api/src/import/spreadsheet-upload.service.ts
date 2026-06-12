import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { existsSync } from "fs";
import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { PrismaService } from "../prisma/prisma.service";

export type DeleteUploadMode = "file_and_data" | "file_only";

export interface UploadListItem {
  id: string;
  originalFilename: string;
  createdAt: string;
  stats: Record<string, unknown> | null;
  mappingProfile: { id: string; name: string };
}

@Injectable()
export class SpreadsheetUploadService {
  private readonly storageRoot =
    process.env.STORAGE_ROOT ?? join(process.cwd(), "storage");

  constructor(private readonly prisma: PrismaService) {}

  async findByFilename(filename: string) {
    return this.prisma.spreadsheetUpload.findUnique({
      where: { originalFilename: filename },
      include: { invoices: true },
    });
  }

  async listUploads(): Promise<UploadListItem[]> {
    const uploads = await this.prisma.spreadsheetUpload.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        mappingProfile: { select: { id: true, name: true } },
      },
    });
    return uploads.map((upload) => ({
      id: upload.id,
      originalFilename: upload.originalFilename,
      createdAt: upload.createdAt.toISOString(),
      stats: upload.stats as Record<string, unknown> | null,
      mappingProfile: upload.mappingProfile,
    }));
  }

  async saveFile(
    uploadId: string,
    filename: string,
    buffer: Buffer,
  ): Promise<string> {
    const dir = join(this.storageRoot, "uploads", uploadId);
    await mkdir(dir, { recursive: true });
    const fullPath = join(dir, filename);
    await writeFile(fullPath, buffer);
    return join("uploads", uploadId, filename);
  }

  async deleteStoredFile(storedPath: string): Promise<void> {
    const fullPath = join(this.storageRoot, storedPath);
    if (existsSync(fullPath)) {
      await rm(fullPath, { force: true });
    }
    const dir = join(fullPath, "..");
    if (existsSync(dir)) {
      await rm(dir, { recursive: true, force: true });
    }
  }

  async getLinkedInvoiceNumbers(uploadId: string): Promise<Set<string>> {
    const links = await this.prisma.spreadsheetUploadInvoice.findMany({
      where: { uploadId },
      select: { invoiceNumber: true },
    });
    return new Set(links.map((link) => link.invoiceNumber));
  }

  async linkInvoices(
    uploadId: string,
    links: Array<{ invoiceId: string; invoiceNumber: string }>,
  ): Promise<void> {
    await this.prisma.spreadsheetUploadInvoice.deleteMany({
      where: { uploadId },
    });
    if (links.length === 0) {
      return;
    }
    await this.prisma.spreadsheetUploadInvoice.createMany({
      data: links.map((link) => ({
        uploadId,
        invoiceId: link.invoiceId,
        invoiceNumber: link.invoiceNumber,
      })),
    });
  }

  async removeInvoicesMissingFromReplace(
    uploadId: string,
    invoiceNumbersToRemove: string[],
  ): Promise<number> {
    let deleted = 0;
    for (const invoiceNumber of invoiceNumbersToRemove) {
      const junction = await this.prisma.spreadsheetUploadInvoice.findFirst({
        where: { uploadId, invoiceNumber },
        include: {
          invoice: {
            include: { spreadsheetUploads: true },
          },
        },
      });
      if (!junction) {
        continue;
      }

      if (junction.invoice.spreadsheetUploads.length <= 1) {
        await this.prisma.invoice.delete({
          where: { id: junction.invoiceId },
        });
        deleted++;
      } else {
        await this.prisma.spreadsheetUploadInvoice.delete({
          where: {
            uploadId_invoiceId: {
              uploadId,
              invoiceId: junction.invoiceId,
            },
          },
        });
      }
    }
    return deleted;
  }

  async createUpload(data: {
    originalFilename: string;
    storedPath: string;
    mappingProfileId: string;
    columnMapSnapshot: Record<string, string>;
    stats: Prisma.InputJsonValue;
    uploadedByUserId?: string;
  }) {
    return this.prisma.spreadsheetUpload.create({
      data: {
        originalFilename: data.originalFilename,
        storedPath: data.storedPath,
        mappingProfileId: data.mappingProfileId,
        columnMapSnapshot: data.columnMapSnapshot,
        stats: data.stats,
        uploadedByUserId: data.uploadedByUserId,
      },
    });
  }

  async updateUpload(
    id: string,
    data: Prisma.SpreadsheetUploadUpdateInput,
  ) {
    return this.prisma.spreadsheetUpload.update({
      where: { id },
      data,
    });
  }

  async deleteUpload(
    id: string,
    mode: DeleteUploadMode = "file_and_data",
  ): Promise<void> {
    const upload = await this.prisma.spreadsheetUpload.findUnique({
      where: { id },
      include: { invoices: true },
    });
    if (!upload) {
      throw new NotFoundException("Upload not found");
    }

    if (mode === "file_only") {
      await this.prisma.spreadsheetUploadInvoice.deleteMany({
        where: { uploadId: id },
      });
    } else {
      for (const link of upload.invoices) {
        const uploadLinkCount = await this.prisma.spreadsheetUploadInvoice.count({
          where: { invoiceId: link.invoiceId },
        });
        if (uploadLinkCount <= 1) {
          await this.prisma.invoice.delete({ where: { id: link.invoiceId } });
        } else {
          await this.prisma.spreadsheetUploadInvoice.delete({
            where: {
              uploadId_invoiceId: { uploadId: id, invoiceId: link.invoiceId },
            },
          });
        }
      }
    }

    await this.deleteStoredFile(upload.storedPath);
    await this.prisma.spreadsheetUpload.delete({ where: { id } });
  }
}
