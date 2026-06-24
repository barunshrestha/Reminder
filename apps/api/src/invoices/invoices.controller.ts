import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { PatchVendorInvoiceDto } from "./dto/patch-invoice.dto";
import { InvoiceEmailService } from "./invoice-email.service";
import { InvoicesService } from "./invoices.service";

@Controller("invoices")
@UseGuards(JwtAuthGuard)
export class InvoicesController {
  constructor(
    private readonly service: InvoicesService,
    private readonly invoiceEmail: InvoiceEmailService,
  ) {}

  @Get()
  findAll(
    @Query("status") status?: string,
    @Query("send_reminder") sendReminder?: string,
  ) {
    return this.service.findAll({ status, send_reminder: sendReminder });
  }

  @Get(":invoiceNumber/changes")
  listChanges(@Param("invoiceNumber") invoiceNumber: string) {
    return this.service.listChanges(invoiceNumber);
  }

  @Post(":invoiceNumber/send-email")
  @UseGuards(RolesGuard)
  @Roles("admin")
  sendEmail(
    @Param("invoiceNumber") invoiceNumber: string,
    @CurrentUser() user?: { id: string },
  ) {
    return this.invoiceEmail.sendToClient(invoiceNumber, user?.id);
  }

  @Get(":invoiceNumber")
  findOne(@Param("invoiceNumber") invoiceNumber: string) {
    return this.service.findOne(invoiceNumber);
  }

  @Patch(":invoiceNumber")
  patch(
    @Param("invoiceNumber") invoiceNumber: string,
    @Body() dto: PatchVendorInvoiceDto,
    @CurrentUser() user?: { id: string },
  ) {
    return this.service.patch(invoiceNumber, dto, user?.id);
  }
}
