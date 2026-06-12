import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createReadStream, existsSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { PrismaService } from "../../prisma/prisma.service";

export interface ScanUploadListItem {
  id: string;
  originalFilename: string;
  createdAt: string;
  stats: Record<string, unknown> | null;
}

@Injectable()
export class InvoiceScanUploadService {
  private readonly storageRoot =
    process.env.STORAGE_ROOT ?? join(process.cwd(), "storage");

  constructor(private readonly prisma: PrismaService) {}

  async listUploads(): Promise<ScanUploadListItem[]> {
    const uploads = await this.prisma.invoiceScanUpload.findMany({
      orderBy: { createdAt: "desc" },
    });
    return uploads.map((upload) => ({
      id: upload.id,
      originalFilename: upload.originalFilename,
      createdAt: upload.createdAt.toISOString(),
      stats: upload.stats as Record<string, unknown> | null,
    }));
  }

  async createPendingUpload(input: {
    originalFilename: string;
    mimeType: string;
    uploadedByUserId?: string;
  }) {
    return this.prisma.invoiceScanUpload.create({
      data: {
        originalFilename: input.originalFilename,
        storedPath: "",
        mimeType: input.mimeType,
        uploadedBy: input.uploadedByUserId
          ? { connect: { id: input.uploadedByUserId } }
          : undefined,
      },
    });
  }

  async saveFile(
    uploadId: string,
    filename: string,
    buffer: Buffer,
  ): Promise<string> {
    const dir = join(this.storageRoot, "scans", uploadId);
    await mkdir(dir, { recursive: true });
    const fullPath = join(dir, filename);
    await writeFile(fullPath, buffer);
    return join("scans", uploadId, filename);
  }

  async updateUpload(
    id: string,
    data: Prisma.InvoiceScanUploadUpdateInput,
  ): Promise<void> {
    await this.prisma.invoiceScanUpload.update({ where: { id }, data });
  }

  async findById(id: string) {
    const upload = await this.prisma.invoiceScanUpload.findUnique({
      where: { id },
    });
    if (!upload) {
      throw new NotFoundException("Scan upload not found");
    }
    return upload;
  }

  getAbsolutePath(storedPath: string): string {
    return join(this.storageRoot, storedPath);
  }

  createReadStream(storedPath: string) {
    const absolute = this.getAbsolutePath(storedPath);
    if (!existsSync(absolute)) {
      throw new NotFoundException("Scan image not found");
    }
    return createReadStream(absolute);
  }

  async linkInvoice(
    uploadId: string,
    invoiceId: string,
    invoiceNumber: string,
  ): Promise<void> {
    await this.prisma.invoiceScanUploadInvoice.create({
      data: {
        uploadId,
        invoiceId,
        invoiceNumber,
      },
    });
  }
}
