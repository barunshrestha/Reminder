import { Controller, Get, Post, Req } from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import { Public } from "../auth/public.decorator";
import { requireAccountId } from "../tenancy/tenant-context";
import {
  activateTenantContext,
  type TenantRequest,
} from "../tenancy/tenant-request.util";
import { PrismaService } from "../prisma/prisma.service";
import { PLANS } from "./plans";
import { StripeBillingService } from "./stripe-billing.service";
import { UsageService } from "./usage.service";

@Controller("billing")
export class BillingController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usage: UsageService,
    private readonly stripe: StripeBillingService,
  ) {}

  @Get("plans")
  @Public()
  listPlans() {
    return PLANS;
  }

  @Get("subscription")
  async getSubscription(@Req() req: TenantRequest) {
    return activateTenantContext(req, async () => {
      const accountId = requireAccountId();
      return this.prisma.subscription.findFirst({
        where: { accountId },
        include: { plan: true },
        orderBy: { createdAt: "desc" },
      });
    });
  }

  @Get("usage")
  async getUsage(@Req() req: TenantRequest) {
    return activateTenantContext(req, async () => {
      const tenantId = req.tenantContext!.tenantId;
      const metrics = ["invoices", "schedules", "connectors", "imports"] as const;
      const usage: Record<string, number> = {};
      for (const metric of metrics) {
        usage[metric] = await this.usage.getUsage(tenantId, metric);
      }
      return { period: this.usage.currentPeriod(), usage };
    });
  }

  @Post("webhooks/stripe")
  @Public()
  stripeWebhook(@Req() req: RawBodyRequest<Request>) {
    const signature = req.headers["stripe-signature"] as string | undefined;
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    return this.stripe.handleWebhook(rawBody, signature);
  }
}
