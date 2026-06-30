import { BadRequestException, Injectable } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { runWithTenantContext } from "../tenancy/tenant-context";
import { tenantInvoiceUnique } from "../tenancy/tenant-scope";

@Injectable()
export class UnsubscribeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async unsubscribeByEmail(email: string, invoiceNumber?: string) {
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes("@")) {
      throw new BadRequestException("Valid email required");
    }

    let tenantId: string | undefined;
    if (invoiceNumber) {
      const invoice = await this.prisma.invoice.findFirst({
        where: { invoiceNumber },
        select: { tenantId: true },
      });
      tenantId = invoice?.tenantId;
    }

    const where = invoiceNumber
      ? {
          invoiceNumber,
          clientEmail: { equals: normalized, mode: "insensitive" as const },
          ...(tenantId ? { tenantId } : {}),
        }
      : {
          clientEmail: { equals: normalized, mode: "insensitive" as const },
        };

    const result = await this.prisma.invoice.updateMany({
      where,
      data: { emailOptOut: true },
    });

    if (tenantId) {
      await runWithTenantContext(
        {
          tenantId,
          accountId: "",
          userId: "public",
          tenantRole: "operator",
          mfaVerified: true,
        },
        async () => {
          await this.prisma.optOutEvent.create({
            data: {
              tenantId,
              email: normalized,
              invoiceNumber: invoiceNumber ?? null,
              source: "unsubscribe_link",
            },
          });

          await this.audit.record("email.opt_out", {
            email: normalized,
            invoice_number: invoiceNumber ?? null,
            invoices_updated: result.count,
          });
        },
      );
    }

    return {
      ok: true,
      email: normalized,
      invoices_updated: result.count,
    };
  }
}
