import { Injectable } from "@nestjs/common";
import {
  computeContentHash,
  type ContentHashInput,
  type InvoiceStatus,
  type ReminderDeliveryMode,
} from "@payment-reminder/domain";
import {
  InvoiceChangeAction,
  InvoiceStatus as PrismaInvoiceStatus,
  type Invoice,
  Prisma,
  ReminderDeliveryMode as PrismaDeliveryMode,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { ChangeLogContext } from "./invoice-change-log.service";
import { InvoiceChangeLogService } from "./invoice-change-log.service";
import {
  snapshotFromInput,
  snapshotFromInvoice,
} from "./invoice-snapshot.util";

export interface UpsertInvoiceInput {
  clientName: string;
  invoiceNumber: string;
  totalAmount: string;
  balanceDue: string;
  dueDate: string;
  dateOfService?: string | null;
  services?: Array<string | { name: string; amount?: string }>;
  clientEmail?: string | null;
  clientPhone?: string | null;
  comments?: string | null;
  sendReminder?: boolean;
  externalClientId?: string | null;
  status?: InvoiceStatus;
  emailOptOut?: boolean;
  consentEmail?: boolean;
  reminderDeliveryMode?: ReminderDeliveryMode;
}

export type RowClassification = "new" | "unchanged" | "conflict";

export interface WriteContext extends ChangeLogContext {
  importRowId?: string;
}

@Injectable()
export class InvoiceUpsertService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly changeLog: InvoiceChangeLogService,
  ) {}

  buildHashInput(input: UpsertInvoiceInput): ContentHashInput {
    const status = resolveStatus(input);
    return {
      invoiceNumber: input.invoiceNumber,
      clientName: input.clientName,
      totalAmount: input.totalAmount,
      balanceDue: input.balanceDue,
      dueDate: input.dueDate,
      dateOfService: input.dateOfService ?? null,
      services: input.services,
      clientEmail: input.clientEmail ?? null,
      clientPhone: input.clientPhone ?? null,
      comments: input.comments ?? null,
      externalClientId: input.externalClientId ?? null,
      status,
      emailOptOut: input.emailOptOut ?? false,
      consentEmail: input.consentEmail ?? true,
      reminderDeliveryMode: input.reminderDeliveryMode ?? "email",
    };
  }

  classify(existing: Invoice | null, input: UpsertInvoiceInput): RowClassification {
    if (!existing) {
      return "new";
    }
    const contentHash = computeContentHash(this.buildHashInput(input));
    if (existing.contentHash === contentHash) {
      return "unchanged";
    }
    return "conflict";
  }

  async insertNew(
    input: UpsertInvoiceInput,
    context: WriteContext,
  ): Promise<{ invoiceId: string }> {
    const data = this.buildWriteData(input);
    const created = await this.prisma.invoice.create({ data });
    await this.changeLog.record({
      invoiceId: created.id,
      invoiceNumber: created.invoiceNumber,
      action: InvoiceChangeAction.inserted,
      before: null,
      after: snapshotFromInvoice(created),
      context,
    });
    return { invoiceId: created.id };
  }

  async updateExisting(
    existing: Invoice,
    input: UpsertInvoiceInput,
    context: WriteContext,
  ): Promise<{ invoiceId: string }> {
    const before = snapshotFromInvoice(existing);
    const data = this.buildWriteData(input);
    const updated = await this.prisma.invoice.update({
      where: { id: existing.id },
      data,
    });
    await this.changeLog.record({
      invoiceId: updated.id,
      invoiceNumber: updated.invoiceNumber,
      action: InvoiceChangeAction.updated,
      before,
      after: snapshotFromInvoice(updated),
      context,
    });
    return { invoiceId: updated.id };
  }

  async touchUnchanged(
    existing: Invoice,
    context: WriteContext,
  ): Promise<{ invoiceId: string }> {
    await this.prisma.invoice.update({
      where: { id: existing.id },
      data: {
        lastSeenAt: new Date(),
        missedSyncCount: 0,
      },
    });
    await this.changeLog.record({
      invoiceId: existing.id,
      invoiceNumber: existing.invoiceNumber,
      action: InvoiceChangeAction.skipped,
      before: snapshotFromInvoice(existing),
      after: snapshotFromInvoice(existing),
      context,
    });
    return { invoiceId: existing.id };
  }

  async deleteInvoiceSafe(
    invoiceId: string,
    context: WriteContext,
  ): Promise<boolean> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        spreadsheetUploads: true,
        invoiceScanUploads: true,
      },
    });
    if (!invoice) {
      return false;
    }

    const before = snapshotFromInvoice(invoice);
    const linkCount =
      invoice.spreadsheetUploads.length + invoice.invoiceScanUploads.length;

    if (linkCount > 1) {
      return false;
    }

    await this.prisma.invoice.delete({ where: { id: invoiceId } });
    await this.changeLog.record({
      invoiceId: null,
      invoiceNumber: invoice.invoiceNumber,
      action: InvoiceChangeAction.deleted,
      before,
      after: null,
      context,
    });
    return true;
  }

  inputToSnapshot(input: UpsertInvoiceInput) {
    return snapshotFromInput(input);
  }

  async upsertOne(
    input: UpsertInvoiceInput,
    context?: WriteContext,
  ): Promise<{
    outcome: "inserted" | "updated" | "skipped";
    invoiceId: string;
  }> {
    const writeContext: WriteContext = context ?? {
      source: "legacy.upsert",
    };

    const existing = await this.prisma.invoice.findUnique({
      where: { invoiceNumber: input.invoiceNumber },
    });

    const classification = this.classify(existing, input);

    if (classification === "unchanged" && existing) {
      await this.touchUnchanged(existing, writeContext);
      return { outcome: "skipped", invoiceId: existing.id };
    }

    if (classification === "conflict" && existing) {
      const { invoiceId } = await this.updateExisting(
        existing,
        input,
        writeContext,
      );
      return { outcome: "updated", invoiceId };
    }

    const { invoiceId } = await this.insertNew(input, writeContext);
    return { outcome: "inserted", invoiceId };
  }

  async upsertBatch(
    inputs: UpsertInvoiceInput[],
    options?: {
      completeSync?: boolean;
      context?: WriteContext;
    },
  ): Promise<{
    inserted: number;
    updated: number;
    skippedUnchanged: number;
    deactivated: number;
    missedSyncIncrements: number;
  }> {
    const result = {
      inserted: 0,
      updated: 0,
      skippedUnchanged: 0,
      deactivated: 0,
      missedSyncIncrements: 0,
    };

    const seen: string[] = [];
    const writeContext: WriteContext = options?.context ?? {
      source: "legacy.upsert_batch",
    };

    for (const input of inputs) {
      seen.push(input.invoiceNumber);
      const { outcome } = await this.upsertOne(input, writeContext);
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

  private buildWriteData(input: UpsertInvoiceInput) {
    const status = resolveStatus(input);
    const contentHash = computeContentHash(this.buildHashInput(input));
    const balance = new Prisma.Decimal(input.balanceDue);
    const paidOrZero = status !== "open" || balance.lte(0);

    return {
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
      clientPhone: input.clientPhone ?? null,
      comments: input.comments ?? null,
      sendReminder: input.sendReminder ?? true,
      externalClientId: input.externalClientId ?? null,
      status: paidOrZero ? PrismaInvoiceStatus.paid : mapStatus(status),
      paidAt: paidOrZero ? new Date() : null,
      emailOptOut: input.emailOptOut ?? false,
      consentEmail: input.consentEmail ?? true,
      reminderDeliveryMode: mapDeliveryMode(input.reminderDeliveryMode),
      contentHash,
      lastSeenAt: new Date(),
      isActive: true,
      missedSyncCount: 0,
    };
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

function mapDeliveryMode(
  mode?: ReminderDeliveryMode,
): PrismaDeliveryMode {
  switch (mode) {
    case "phone":
      return PrismaDeliveryMode.phone;
    case "document_only":
      return PrismaDeliveryMode.document_only;
    case "na":
      return PrismaDeliveryMode.na;
    default:
      return PrismaDeliveryMode.email;
  }
}
