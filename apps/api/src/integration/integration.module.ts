import { Module } from "@nestjs/common";
import { InvoiceUpsertService } from "../invoices/invoice-upsert.service";
import { PrismaModule } from "../prisma/prisma.module";
import { ApiKeyGuard } from "./api-key.guard";
import { IdempotencyService } from "./idempotency.service";
import { IntegrationController } from "./integration.controller";
import { IntegrationService } from "./integration.service";

@Module({
  imports: [PrismaModule],
  controllers: [IntegrationController],
  providers: [
    IntegrationService,
    IdempotencyService,
    ApiKeyGuard,
    InvoiceUpsertService,
  ],
  exports: [IntegrationService, InvoiceUpsertService],
})
export class IntegrationModule {}
