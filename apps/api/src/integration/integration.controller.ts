import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { ImportResolution } from "@prisma/client";
import { Public } from "../auth/public.decorator";
import { SkipTenant } from "../tenancy/tenancy.decorator";
import { ApiKeyGuard } from "./api-key.guard";
import { BulkInvoicesDto } from "./dto/bulk-invoices.dto";
import { PatchIntegrationInvoiceDto } from "./dto/patch-invoice.dto";
import { IntegrationService } from "./integration.service";

type ApiKeyRequest = Request & { apiKeyId?: string };

@Controller("integration")
@Public()
@SkipTenant()
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
    @Req() req: ApiKeyRequest,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    return this.service.bulkUpsert(dto, req.apiKeyId, idempotencyKey);
  }

  @Post("invoices/bulk/:batchId/resolve")
  resolveBulk(
    @Param("batchId") batchId: string,
    @Body()
    body: {
      decisions: Array<{
        import_row_id: string;
        resolution: ImportResolution;
      }>;
    },
    @Req() req: ApiKeyRequest,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    return this.service.resolveBulk(
      batchId,
      body.decisions ?? [],
      req.apiKeyId,
      idempotencyKey,
    );
  }

  @Patch("invoices/:invoiceNumber")
  patch(
    @Param("invoiceNumber") invoiceNumber: string,
    @Body() dto: PatchIntegrationInvoiceDto,
    @Req() req: ApiKeyRequest,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    return this.service.patchInvoice(
      invoiceNumber,
      dto,
      req.apiKeyId,
      idempotencyKey,
    );
  }
}
