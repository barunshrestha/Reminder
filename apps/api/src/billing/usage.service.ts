import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { requireTenantId } from "../tenancy/tenant-context";

export type UsageMetric = "invoices" | "schedules" | "connectors" | "imports";

@Injectable()
export class UsageService {
  constructor(private readonly prisma: PrismaService) {}

  currentPeriod(): string {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  async getUsage(tenantId: string, metric: UsageMetric): Promise<number> {
    const counter = await this.prisma.usageCounter.findUnique({
      where: {
        tenantId_metric_period: {
          tenantId,
          metric,
          period: this.currentPeriod(),
        },
      },
    });
    return counter?.count ?? 0;
  }

  async increment(metric: UsageMetric, amount = 1): Promise<number> {
    const tenantId = requireTenantId();
    const period = this.currentPeriod();
    const counter = await this.prisma.usageCounter.upsert({
      where: {
        tenantId_metric_period: { tenantId, metric, period },
      },
      create: { tenantId, metric, period, count: amount },
      update: { count: { increment: amount } },
    });
    return counter.count;
  }

  async assertWithinLimit(
    tenantId: string,
    accountId: string,
    metric: UsageMetric,
    additional = 1,
  ): Promise<void> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { accountId, status: { in: ["trialing", "active"] } },
      include: { plan: true },
    });
    if (!subscription) {
      throw new ForbiddenException("No active subscription");
    }

    const limits: Record<UsageMetric, number> = {
      invoices: subscription.plan.invoiceLimit,
      schedules: subscription.plan.scheduleLimit,
      connectors: subscription.plan.connectorLimit,
      imports: subscription.plan.invoiceLimit * 10,
    };

    const current = await this.getUsage(tenantId, metric);
    if (current + additional > limits[metric]) {
      throw new ForbiddenException(`Plan limit reached for ${metric}`);
    }
  }
}
