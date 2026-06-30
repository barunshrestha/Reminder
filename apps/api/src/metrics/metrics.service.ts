import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { tenantFilter } from "../tenancy/tenant-scope";

@Injectable()
export class MetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const tenantWhere = tenantFilter();
    const [open, paid, closed, active, optedOut, emailsSent, emailsFailed, docsGenerated, bulkEvents] =
      await Promise.all([
        this.prisma.invoice.count({ where: { ...tenantWhere, status: "open" } }),
        this.prisma.invoice.count({ where: { ...tenantWhere, status: "paid" } }),
        this.prisma.invoice.count({ where: { ...tenantWhere, status: "closed" } }),
        this.prisma.invoice.count({ where: { ...tenantWhere, isActive: true } }),
        this.prisma.invoice.count({ where: { ...tenantWhere, emailOptOut: true } }),
        this.prisma.auditEvent.count({ where: { ...tenantWhere, eventType: "email.sent" } }),
        this.prisma.auditEvent.count({ where: { ...tenantWhere, eventType: "email.failed" } }),
        this.prisma.auditEvent.count({
          where: { ...tenantWhere, eventType: "document.generated" },
        }),
        this.prisma.auditEvent.findMany({
          where: { ...tenantWhere, eventType: "integration.bulk_upsert" },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
      ]);

    const skippedUnchanged = sumPayloadField(bulkEvents, "skipped_unchanged");
    const bulkRows = sumPayloadField(bulkEvents, "row_count");
    const deltaSkipRate =
      bulkRows > 0 ? Math.round((skippedUnchanged / bulkRows) * 100) : null;

    const emailAttempts = emailsSent + emailsFailed;
    const emailDeliveryRate =
      emailAttempts > 0
        ? Math.round((emailsSent / emailAttempts) * 10000) / 100
        : null;

    return {
      invoices: {
        open,
        paid,
        closed,
        active,
        email_opt_out: optedOut,
      },
      reminders: {
        emails_sent: emailsSent,
        emails_failed: emailsFailed,
        email_delivery_rate_pct: emailDeliveryRate,
        documents_generated: docsGenerated,
      },
      sync: {
        bulk_runs_sampled: bulkEvents.length,
        skipped_unchanged_total: skippedUnchanged,
        rows_processed_total: bulkRows,
        delta_skip_rate_pct: deltaSkipRate,
      },
      generated_at: new Date().toISOString(),
    };
  }
}

function sumPayloadField(
  events: { payload: unknown }[],
  field: string,
): number {
  return events.reduce((sum, e) => {
    const payload = e.payload as Record<string, number> | null;
    return sum + (payload?.[field] ?? 0);
  }, 0);
}
