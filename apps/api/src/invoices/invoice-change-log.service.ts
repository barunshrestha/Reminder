import { Injectable } from "@nestjs/common";
import {
  InvoiceChangeAction,
  type Prisma,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { InvoiceSnapshot } from "./invoice-snapshot.util";

export interface ChangeLogContext {
  source: string;
  importRowId?: string;
  actorUserId?: string;
  actorApiKeyId?: string;
}

@Injectable()
export class InvoiceChangeLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(params: {
    invoiceId?: string | null;
    invoiceNumber: string;
    action: InvoiceChangeAction;
    before?: InvoiceSnapshot | null;
    after?: InvoiceSnapshot | null;
    context: ChangeLogContext;
  }): Promise<string> {
    const row = await this.prisma.invoiceChangeLog.create({
      data: {
        invoiceId: params.invoiceId ?? null,
        invoiceNumber: params.invoiceNumber,
        source: params.context.source,
        action: params.action,
        importRowId: params.context.importRowId ?? null,
        actorUserId: params.context.actorUserId ?? null,
        actorApiKeyId: params.context.actorApiKeyId ?? null,
        before: (params.before ?? null) as Prisma.InputJsonValue,
        after: (params.after ?? null) as Prisma.InputJsonValue,
      },
    });
    return row.id;
  }

  listByInvoiceNumber(invoiceNumber: string, limit = 50) {
    return this.prisma.invoiceChangeLog.findMany({
      where: { invoiceNumber },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }
}
