import {
  Injectable,
  NotFoundException,
  StreamableFile,
} from "@nestjs/common";
import { createReadStream, existsSync } from "fs";
import { join } from "path";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DocumentsService {
  private readonly storageRoot =
    process.env.STORAGE_ROOT ?? join(process.cwd(), "storage");

  constructor(private readonly prisma: PrismaService) {}

  async getDocumentStream(id: string): Promise<StreamableFile> {
    const doc = await this.prisma.notificationDocument.findUnique({
      where: { id },
    });
    if (!doc) {
      throw new NotFoundException("Document not found");
    }
    const path = join(this.storageRoot, doc.pdfStorageKey);
    if (!existsSync(path)) {
      throw new NotFoundException("PDF file not found on disk");
    }
    return new StreamableFile(createReadStream(path), {
      type: "application/pdf",
      disposition: `attachment; filename="${doc.invoiceId}-${doc.tier}.pdf"`,
    });
  }

  async getHtmlPreview(id: string): Promise<{ html: string }> {
    const doc = await this.prisma.notificationDocument.findUnique({
      where: { id },
    });
    if (!doc?.htmlSnapshot) {
      throw new NotFoundException("Document not found");
    }
    return { html: doc.htmlSnapshot };
  }

  async listByRun(runId: string) {
    return this.prisma.notificationDocument.findMany({
      where: { runId },
      orderBy: { generatedAt: "desc" },
    });
  }
}
