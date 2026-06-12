import { Injectable } from "@nestjs/common";
import {
  computeContentHash,
  type ContentHashInput,
  type InvoiceStatus,
  type ReminderDeliveryMode,
} from "@payment-reminder/domain";
import {
  InvoiceStatus as PrismaInvoiceStatus,
  Prisma,
  ReminderDeliveryMode as PrismaDeliveryMode,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export interface UpsertInvoiceInput {
  clientName: string;
  invoiceNumber: string;
  totalAmount: string;
  balanceDue: string;
  dueDate: string;
  dateOfService?: string | null;
  services?: Array<string | { name: string; amount?: string }>;
  clientEmail?: string | null;
  comments?: string | null;
  sendReminder?: boolean;
  externalClientId?: string | null;
  status?: InvoiceStatus;
  emailOptOut?: boolean;
  consentEmail?: boolean;
  reminderDeliveryMode?: ReminderDeliveryMode;
}

export interface UpsertBatchResult {
  inserted: number;
  updated: number;
  skippedUnchanged: number;
  deactivated: number;
  missedSyncIncrements: number;
}

@Injectable()
export class InvoiceUpsertService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertOne(
    input: UpsertInvoiceInput,
  ): Promise<{
    outcome: "inserted" | "updated" | "skipped";
    invoiceId: string;
  }> {
    const status = resolveStatus(input);
    const hashInput: ContentHashInput = {
      invoiceNumber: input.invoiceNumber,
      clientName: input.clientName,
      totalAmount: input.totalAmount,
      balanceDue: input.balanceDue,
      dueDate: input.dueDate,
      dateOfService: input.dateOfService ?? null,
      services: input.services,
      clientEmail: input.clientEmail ?? null,
      comments: input.comments ?? null,
      externalClientId: input.externalClientId ?? null,
      status,
      emailOptOut: input.emailOptOut ?? false,
      consentEmail: input.consentEmail ?? true,
      reminderDeliveryMode: input.reminderDeliveryMode ?? "email",
    };
    const contentHash = computeContentHash(hashInput);

    const existing = await this.prisma.invoice.findUnique({
      where: { invoiceNumber: input.invoiceNumber },
    });

    if (existing && existing.contentHash === contentHash) {
      await this.prisma.invoice.update({
        where: { id: existing.id },
        data: {
          lastSeenAt: new Date(),
          missedSyncCount: 0,
        },
      });
      return { outcome: "skipped", invoiceId: existing.id };
    }

    const balance = new Prisma.Decimal(input.balanceDue);
    const paidOrZero =
      status !== "open" || balance.lte(0);

    const data = {
      clientName: input.clientName,
      invoiceNumber: input.invoiceNumber,
      totalAmount: new Prisma.Decimal(input.totalAmount),
      balanceDue: balance,
      dueDate: new Date(`${input.dueDate}T00:00:00.000Z`),
      dateOfService: input.dateOfService
        ? new Date(`${input.dateOfService}T00:00:00.000Z`)
        : null,
      services: input.services ?? undefined,
      clientEmail: input.clientEmail ?? null,
      comments: input.comments ?? null,
      sendReminder: input.sendReminder ?? true,
      externalClientId: input.externalClientId ?? null,
      status: paidOrZero
        ? PrismaInvoiceStatus.paid
        : mapStatus(status),
      paidAt: paidOrZero ? new Date() : null,
      emailOptOut: input.emailOptOut ?? false,
      consentEmail: input.consentEmail ?? true,
      reminderDeliveryMode:
        input.reminderDeliveryMode === "document_only"
          ? PrismaDeliveryMode.document_only
          : PrismaDeliveryMode.email,
      contentHash,
      lastSeenAt: new Date(),
      isActive: true,
      missedSyncCount: 0,
    };

    if (existing) {
      await this.prisma.invoice.update({
        where: { id: existing.id },
        data,
      });
      return { outcome: "updated", invoiceId: existing.id };
    }

    const created = await this.prisma.invoice.create({ data });
    return { outcome: "inserted", invoiceId: created.id };
  }

  async upsertBatch(
    inputs: UpsertInvoiceInput[],
    options?: { completeSync?: boolean },
  ): Promise<UpsertBatchResult> {
    const result: UpsertBatchResult = {
      inserted: 0,
      updated: 0,
      skippedUnchanged: 0,
      deactivated: 0,
      missedSyncIncrements: 0,
    };

    const seen: string[] = [];
    for (const input of inputs) {
      seen.push(input.invoiceNumber);
      const { outcome } = await this.upsertOne(input);
      if (outcome === "inserted") {
        result.inserted++;
      } else if (outcome === "updated") {
        result.updated++;
      } else {
        result.skippedUnchanged++;
      }
    }

    if (options?.completeSync) {
      const finalize = await this.finalizeSync(seen);
      result.deactivated = finalize.deactivated;
      result.missedSyncIncrements = finalize.missedSyncIncrements;
    }

    return result;
  }

  async finalizeSync(seenInvoiceNumbers: string[]): Promise<{
    deactivated: number;
    missedSyncIncrements: number;
  }> {
    const seen = new Set(seenInvoiceNumbers);
    const vendor = await this.prisma.vendorSettings.findFirstOrThrow({
      where: { id: "default" },
    });
    const active = await this.prisma.invoice.findMany({
      where: { isActive: true },
      select: { id: true, invoiceNumber: true, missedSyncCount: true },
    });

    let deactivated = 0;
    let missedSyncIncrements = 0;

    for (const invoice of active) {
      if (seen.has(invoice.invoiceNumber)) {
        continue;
      }
      const nextCount = invoice.missedSyncCount + 1;
      if (nextCount >= vendor.missedSyncsBeforeInactive) {
        await this.prisma.invoice.update({
          where: { id: invoice.id },
          data: { isActive: false, missedSyncCount: nextCount },
        });
        deactivated++;
      } else {
        await this.prisma.invoice.update({
          where: { id: invoice.id },
          data: { missedSyncCount: nextCount },
        });
        missedSyncIncrements++;
      }
    }

    return { deactivated, missedSyncIncrements };
  }
}

function resolveStatus(input: UpsertInvoiceInput): InvoiceStatus {
  if (input.status) {
    return input.status;
  }
  if (Number.parseFloat(input.balanceDue) <= 0) {
    return "paid";
  }
  return "open";
}

function mapStatus(status: InvoiceStatus): PrismaInvoiceStatus {
  switch (status) {
    case "paid":
      return PrismaInvoiceStatus.paid;
    case "closed":
      return PrismaInvoiceStatus.closed;
    default:
      return PrismaInvoiceStatus.open;
  }
}
