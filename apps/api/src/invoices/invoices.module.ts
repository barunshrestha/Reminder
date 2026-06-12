import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { InvoiceUpsertService } from "./invoice-upsert.service";
import { InvoicesController } from "./invoices.controller";
import { InvoicesService } from "./invoices.service";

@Module({
  imports: [PrismaModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoiceUpsertService],
  exports: [InvoiceUpsertService, InvoicesService],
})
export class InvoicesModule {}
