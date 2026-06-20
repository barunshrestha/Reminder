import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { ImportModule } from "../import/import.module";
import { InvoicesModule } from "../invoices/invoices.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ApiKeyGuard } from "./api-key.guard";
import { IdempotencyService } from "./idempotency.service";
import { IntegrationController } from "./integration.controller";
import { IntegrationService } from "./integration.service";

@Module({
  imports: [PrismaModule, InvoicesModule, ImportModule, AuditModule],
  controllers: [IntegrationController],
  providers: [IntegrationService, IdempotencyService, ApiKeyGuard],
  exports: [IntegrationService],
})
export class IntegrationModule {}
