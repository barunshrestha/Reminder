import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { isValidSubdomain, normalizeSubdomain } from "./subdomain.util";

export interface ProvisionTenantInput {
  accountName: string;
  tenantName: string;
  subdomain: string;
  ownerUserId: string;
  planCode?: string;
}

@Injectable()
export class TenantProvisioningService {
  constructor(private readonly prisma: PrismaService) {}

  async provision(input: ProvisionTenantInput) {
    const subdomain = normalizeSubdomain(input.subdomain);
    if (!isValidSubdomain(subdomain)) {
      throw new Error("Invalid subdomain");
    }

    const slug = subdomain;
    const plan = await this.prisma.plan.findFirst({
      where: { code: input.planCode ?? "starter" },
    });
    if (!plan) {
      throw new Error("Plan not found");
    }

    return this.prisma.$transaction(async (tx) => {
      const account = await tx.account.create({
        data: { name: input.accountName },
      });

      await tx.accountMembership.create({
        data: {
          accountId: account.id,
          userId: input.ownerUserId,
          role: "owner",
        },
      });

      const tenant = await tx.tenant.create({
        data: {
          accountId: account.id,
          name: input.tenantName,
          slug,
          subdomain,
        },
      });

      await tx.tenantMembership.create({
        data: {
          tenantId: tenant.id,
          userId: input.ownerUserId,
          role: "admin",
        },
      });

      await tx.tenantSettings.create({
        data: { tenantId: tenant.id },
      });

      await tx.tenantBranding.create({
        data: { tenantId: tenant.id },
      });

      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 14);

      await tx.subscription.create({
        data: {
          accountId: account.id,
          planId: plan.id,
          status: "trialing",
          currentPeriodStart: new Date(),
          currentPeriodEnd: trialEnd,
        },
      });

      return { account, tenant };
    });
  }
}
