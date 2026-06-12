import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ImportService } from "./import.service";
import { SpreadsheetPreviewService } from "./spreadsheet-preview.service";
import {
  SpreadsheetTemplateService,
  type TemplateFormat,
} from "./spreadsheet-template.service";
import {
  SpreadsheetUploadService,
  type DeleteUploadMode,
} from "./spreadsheet-upload.service";
import { UploadConflictException } from "./upload-conflict.exception";

function parseColumnMap(columnMapJson?: string): Record<string, string> | undefined {
  if (!columnMapJson) {
    return undefined;
  }
  return JSON.parse(columnMapJson) as Record<string, string>;
}

function parseOverride(value?: string): boolean {
  return value === "true" || value === "1";
}

function parseDeleteUploadMode(value?: string): DeleteUploadMode {
  if (!value || value === "file_and_data") {
    return "file_and_data";
  }
  if (value === "file_only") {
    return "file_only";
  }
  throw new BadRequestException(
    'mode must be "file_and_data" or "file_only"',
  );
}

function parseTemplateFormat(value?: string): TemplateFormat {
  if (!value || value === "xlsx") {
    return "xlsx";
  }
  if (value === "csv") {
    return "csv";
  }
  throw new BadRequestException('format must be "xlsx" or "csv"');
}

@Controller("import")
@UseGuards(JwtAuthGuard)
export class ImportController {
  constructor(
    private readonly importService: ImportService,
    private readonly uploads: SpreadsheetUploadService,
    private readonly templateService: SpreadsheetTemplateService,
    private readonly previewService: SpreadsheetPreviewService,
  ) {}

  @Get("template")
  async downloadTemplate(
    @Query("mappingProfileId") mappingProfileId: string,
    @Query("format") formatQuery?: string,
  ): Promise<StreamableFile> {
    if (!mappingProfileId) {
      throw new BadRequestException("mappingProfileId query parameter is required");
    }
    const format = parseTemplateFormat(formatQuery);
    const buffer = await this.templateService.generateTemplate(
      mappingProfileId,
      format,
    );
    if (format === "csv") {
      return new StreamableFile(buffer, {
        type: "text/csv",
        disposition: 'attachment; filename="import-template.csv"',
      });
    }
    return new StreamableFile(buffer, {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      disposition: 'attachment; filename="import-template.xlsx"',
    });
  }

  @Get("uploads")
  listUploads() {
    return this.uploads.listUploads();
  }

  @Delete("uploads/:id")
  async deleteUpload(
    @Param("id") id: string,
    @Query("mode") modeQuery?: string,
  ) {
    const mode = parseDeleteUploadMode(modeQuery);
    await this.uploads.deleteUpload(id, mode);
    return { deleted: true, mode };
  }

  @Post("preview")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 25 * 1024 * 1024 } }),
  )
  async previewSpreadsheet(
    @UploadedFile() file: Express.Multer.File,
    @Body("mappingProfileId") mappingProfileId?: string,
    @Body("columnMap") columnMapJson?: string,
  ) {
    if (!file) {
      throw new BadRequestException("file is required");
    }
    return this.previewService.preview(file.buffer, file.originalname, {
      mappingProfileId,
      columnMap: parseColumnMap(columnMapJson),
    });
  }

  @Post("spreadsheet")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 25 * 1024 * 1024 } }),
  )
  async importSpreadsheet(
    @UploadedFile() file: Express.Multer.File,
    @Body("mappingProfileId") mappingProfileId?: string,
    @Body("columnMap") columnMapJson?: string,
    @Body("override") override?: string,
    @CurrentUser() user?: { id: string },
  ) {
    if (!file) {
      throw new BadRequestException("file is required");
    }
    return this.importService.importFile(file.buffer, file.originalname, {
      mappingProfileId,
      columnMap: parseColumnMap(columnMapJson),
      override: parseOverride(override),
      uploadedByUserId: user?.id,
    });
  }

  @Post("spreadsheet/batch")
  @UseInterceptors(
    FilesInterceptor("files", 20, { limits: { fileSize: 25 * 1024 * 1024 } }),
  )
  async importSpreadsheetBatch(
    @UploadedFiles() files: Express.Multer.File[],
    @Body("mappingProfileId") mappingProfileId?: string,
    @Body("columnMap") columnMapJson?: string,
    @Body("override") override?: string,
    @CurrentUser() user?: { id: string },
  ) {
    if (!files?.length) {
      throw new BadRequestException("files are required");
    }

    const columnMap = parseColumnMap(columnMapJson);
    const overrideAll = parseOverride(override);
    const results: Array<Record<string, unknown>> = [];

    for (const file of files) {
      try {
        const result = await this.importService.importFile(
          file.buffer,
          file.originalname,
          {
            mappingProfileId,
            columnMap,
            override: overrideAll,
            uploadedByUserId: user?.id,
          },
        );
        results.push({
          filename: file.originalname,
          ok: true,
          ...result,
        });
      } catch (error) {
        if (error instanceof UploadConflictException) {
          results.push({
            filename: file.originalname,
            ok: false,
            conflict: true,
            existingUploadId: error.existingUploadId,
          });
        } else {
          const message =
            error instanceof Error ? error.message : "Import failed";
          results.push({
            filename: file.originalname,
            ok: false,
            error: message,
          });
        }
      }
    }

    return { results };
  }
}
