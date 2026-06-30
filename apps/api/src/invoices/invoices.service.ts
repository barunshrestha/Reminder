import { Injectable, NotFoundException } from "@nestjs/common";
import { InvoiceStatus, InvoiceChangeAction, Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { InvoiceChangeLogService } from "./invoice-change-log.service";
import { snapshotFromInvoice } from "./invoice-snapshot.util";
import { PrismaService } from "../prisma/prisma.service";
import { requireTenantId } from "../tenancy/tenant-context";
import { tenantFilter } from "../tenancy/tenant-scope";
import type { PatchVendorInvoiceDto } from "./dto/patch-invoice.dto";

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly changeLog: InvoiceChangeLogService,
  ) {}

  findAll(params?: { status?: string; send_reminder?: string }) {
    const where: Prisma.InvoiceWhereInput = { ...tenantFilter() };
    if (params?.status && isInvoiceStatus(params.status)) {
      where.status = params.status;
    }
    if (params?.send_reminder === "true") {
      where.sendReminder = true;
    }
    if (params?.send_reminder === "false") {
      where.sendReminder = false;
    }
    return this.prisma.invoice.findMany({
      where,
      orderBy: { dueDate: "asc" },
      take: 500,
    });
  }

  async findOne(invoiceNumber: string) {
    const tenantId = requireTenantId();
    const invoice = await this.prisma.invoice.findUnique({
      where: { tenantId_invoiceNumber: { tenantId, invoiceNumber } },
      include: {
        notificationDocuments: { orderBy: { generatedAt: "desc" }, take: 10 },
        tierNotifications: { orderBy: { tier: "asc" } },
      },
    });
    if (!invoice) {
      throw new NotFoundException("Invoice not found");
    }
    return invoice;
  }

  listChanges(invoiceNumber: string) {
    return this.changeLog.listByInvoiceNumber(invoiceNumber);
  }

  async patch(
    invoiceNumber: string,
    dto: PatchVendorInvoiceDto,
    actorUserId?: string,
  ) {
    const existing = await this.findOne(invoiceNumber);
    const before = snapshotFromInvoice(existing);
    const data: Prisma.InvoiceUpdateInput = {};
    if (dto.client_name !== undefined) {
      data.clientName = dto.client_name;
    }
    if (dto.balance_due !== undefined) {
      data.balanceDue = new Prisma.Decimal(dto.balance_due);
    }
    if (dto.due_date !== undefined) {
      data.dueDate = new Date(`${dto.due_date}T00:00:00.000Z`);
    }
    if (dto.comments !== undefined) {
      data.comments = dto.comments;
    }
    if (dto.last_tier_sent !== undefined) {
      data.lastTierSent = dto.last_tier_sent;
    }
    if (dto.send_reminder !== undefined) {
      data.sendReminder = dto.send_reminder;
    }
    if (dto.email_opt_out !== undefined) {
      data.emailOptOut = dto.email_opt_out;
    }
    if (dto.consent_email !== undefined) {
      data.consentEmail = dto.consent_email;
    }
    if (dto.client_email !== undefined) {
      data.clientEmail = dto.client_email;
    }
    if (dto.client_phone !== undefined) {
      data.clientPhone = dto.client_phone;
    }
    if (dto.reminder_delivery_mode !== undefined) {
      data.reminderDeliveryMode = dto.reminder_delivery_mode;
    }
    if (dto.status !== undefined) {
      data.status = dto.status;
      if (dto.status === "paid" || dto.status === "closed") {
        data.paidAt = new Date();
      }
    }

    const tenantId = requireTenantId();
    const updated = await this.prisma.invoice.update({
      where: { tenantId_invoiceNumber: { tenantId, invoiceNumber } },
      data,
    });

    await this.changeLog.record({
      invoiceId: updated.id,
      invoiceNumber,
      action: InvoiceChangeAction.updated,
      before,
      after: snapshotFromInvoice(updated),
      context: {
        source: "manual",
        actorUserId,
      },
    });

    await this.audit.record("invoice.updated", {
      invoice_number: invoiceNumber,
      fields: Object.keys(dto),
    });

    return updated;
  }
}

function isInvoiceStatus(value: string): value is InvoiceStatus {
  return value === "open" || value === "paid" || value === "closed";
}
