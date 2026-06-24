import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../prisma/prisma.module";
import { InvoiceChangeLogService } from "./invoice-change-log.service";
import { InvoiceEmailService } from "./invoice-email.service";
import { InvoiceUpsertService } from "./invoice-upsert.service";
import { InvoicesController } from "./invoices.controller";
import { InvoicesService } from "./invoices.service";

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [InvoicesController],
  providers: [
    InvoicesService,
    InvoiceEmailService,
    InvoiceUpsertService,
    InvoiceChangeLogService,
  ],
  exports: [InvoiceUpsertService, InvoicesService, InvoiceChangeLogService],
})
export class InvoicesModule {}
