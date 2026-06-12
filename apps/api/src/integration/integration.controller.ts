import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiKeyGuard } from "./api-key.guard";
import { BulkInvoicesDto } from "./dto/bulk-invoices.dto";
import { PatchIntegrationInvoiceDto } from "./dto/patch-invoice.dto";
import { IntegrationService } from "./integration.service";

@Controller("integration")
@UseGuards(ApiKeyGuard)
export class IntegrationController {
  constructor(private readonly service: IntegrationService) {}

  @Get("health")
  health() {
    return this.service.health();
  }

  @Post("invoices/bulk")
  bulk(
    @Body() dto: BulkInvoicesDto,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    return this.service.bulkUpsert(dto, idempotencyKey);
  }

  @Patch("invoices/:invoiceNumber")
  patch(
    @Param("invoiceNumber") invoiceNumber: string,
    @Body() dto: PatchIntegrationInvoiceDto,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    return this.service.patchInvoice(invoiceNumber, dto, idempotencyKey);
  }
}
