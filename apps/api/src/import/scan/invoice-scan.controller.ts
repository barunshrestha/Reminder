import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import { CurrentUser } from "../../auth/current-user.decorator";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { InvoiceScanService } from "./invoice-scan.service";
import type { ConfirmScanInvoiceInput } from "./invoice-scan.types";

@Controller("import/scan")
@UseGuards(JwtAuthGuard)
export class InvoiceScanController {
  constructor(private readonly scanService: InvoiceScanService) {}

  @Get("history")
  listUploads() {
    return this.scanService.listUploads();
  }

  @Get(":id/image")
  async getImage(@Param("id") id: string): Promise<StreamableFile> {
    const { stream, mimeType, filename } =
      await this.scanService.getImageStream(id);
    return new StreamableFile(stream, {
      type: mimeType,
      disposition: `inline; filename="${filename}"`,
    });
  }

  @Post("extract")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  async extractOne(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user?: { id: string },
  ) {
    if (!file) {
      throw new BadRequestException("file is required");
    }
    return this.scanService.extractOne(
      file.buffer,
      file.originalname,
      file.mimetype,
      user?.id,
    );
  }

  @Post("extract/batch")
  @UseInterceptors(
    FilesInterceptor("files", 20, { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  async extractBatch(
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user?: { id: string },
  ) {
    if (!files?.length) {
      throw new BadRequestException("files are required");
    }
    return this.scanService.extractBatch(
      files.map((file) => ({
        buffer: file.buffer,
        filename: file.originalname,
        mimeType: file.mimetype,
      })),
      user?.id,
    );
  }

  @Post("confirm")
  async confirmOne(
    @Body() body: ConfirmScanInvoiceInput,
    @CurrentUser() user?: { id: string },
  ) {
    return this.scanService.confirmOne(body, user?.id);
  }

  @Post("confirm/batch")
  async confirmBatch(
    @Body() body: { items: ConfirmScanInvoiceInput[] },
    @CurrentUser() user?: { id: string },
  ) {
    return this.scanService.confirmBatch(body.items ?? [], user?.id);
  }
}
