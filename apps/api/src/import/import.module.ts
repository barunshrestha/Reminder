import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../prisma/prisma.module";
import { InvoicesModule } from "../invoices/invoices.module";
import { MappingProfilesModule } from "../mapping-profiles/mapping-profiles.module";
import { ImportAnalyzeService } from "./import-analyze.service";
import { ImportCommitService } from "./import-commit.service";
import { ImportController } from "./import.controller";
import { ImportService } from "./import.service";
import { InvoiceExtractionService } from "./scan/invoice-extraction.service";
import { InvoiceScanController } from "./scan/invoice-scan.controller";
import { InvoiceScanService } from "./scan/invoice-scan.service";
import { InvoiceScanUploadService } from "./scan/invoice-scan-upload.service";
import { SpreadsheetPreviewService } from "./spreadsheet-preview.service";
import { SpreadsheetTemplateService } from "./spreadsheet-template.service";
import { SpreadsheetUploadService } from "./spreadsheet-upload.service";

@Module({
  imports: [PrismaModule, MappingProfilesModule, InvoicesModule, AuditModule],
  controllers: [ImportController, InvoiceScanController],
  providers: [
    ImportService,
    ImportAnalyzeService,
    ImportCommitService,
    SpreadsheetUploadService,
    SpreadsheetTemplateService,
    SpreadsheetPreviewService,
    InvoiceScanUploadService,
    InvoiceExtractionService,
    InvoiceScanService,
  ],
  exports: [ImportAnalyzeService, ImportCommitService],
})
export class ImportModule {}
