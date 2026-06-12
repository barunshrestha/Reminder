import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PatchVendorInvoiceDto } from "./dto/patch-invoice.dto";
import { InvoicesService } from "./invoices.service";

@Controller("invoices")
@UseGuards(JwtAuthGuard)
export class InvoicesController {
  constructor(private readonly service: InvoicesService) {}

  @Get()
  findAll(
    @Query("status") status?: string,
    @Query("send_reminder") sendReminder?: string,
  ) {
    return this.service.findAll({ status, send_reminder: sendReminder });
  }

  @Get(":invoiceNumber")
  findOne(@Param("invoiceNumber") invoiceNumber: string) {
    return this.service.findOne(invoiceNumber);
  }

  @Patch(":invoiceNumber")
  patch(
    @Param("invoiceNumber") invoiceNumber: string,
    @Body() dto: PatchVendorInvoiceDto,
  ) {
    return this.service.patch(invoiceNumber, dto);
  }
}
