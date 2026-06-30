import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { SkipTenant } from "../tenancy/tenancy.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { TenantProvisioningService } from "../tenancy/tenant-provisioning.service";
import {
  activateTenantContext,
  type TenantRequest,
} from "../tenancy/tenant-request.util";
import { CurrentUser } from "../auth/current-user.decorator";

@Controller("accounts")
@SkipTenant()
export class AccountsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provisioning: TenantProvisioningService,
  ) {}

  @Get("me")
  async me(@CurrentUser() user: { id: string }) {
    const memberships = await this.prisma.accountMembership.findMany({
      where: { userId: user.id },
      include: {
        account: {
          include: {
            tenants: {
              select: {
                id: true,
                name: true,
                slug: true,
                subdomain: true,
                status: true,
              },
            },
            subscriptions: {
              include: { plan: true },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
      },
    });
    return memberships.map((m) => ({
      accountId: m.accountId,
      role: m.role,
      account: m.account,
    }));
  }

  @Get("tenants")
  async listTenants(@CurrentUser() user: { id: string }) {
    const memberships = await this.prisma.tenantMembership.findMany({
      where: { userId: user.id },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            subdomain: true,
            status: true,
            accountId: true,
          },
        },
      },
    });
    return memberships.map((m) => ({
      tenantId: m.tenantId,
      role: m.role,
      tenant: m.tenant,
    }));
  }

  @Post("onboard")
  async onboard(
    @CurrentUser() user: { id: string },
    @Body()
    body: {
      account_name: string;
      tenant_name: string;
      subdomain: string;
      plan_code?: string;
    },
  ) {
    const result = await this.provisioning.provision({
      accountName: body.account_name,
      tenantName: body.tenant_name,
      subdomain: body.subdomain,
      ownerUserId: user.id,
      planCode: body.plan_code,
    });
    return {
      accountId: result.account.id,
      tenantId: result.tenant.id,
      slug: result.tenant.slug,
      subdomain: result.tenant.subdomain,
    };
  }

  @Get("current/settings")
  async tenantSettings(@Req() req: TenantRequest) {
    return activateTenantContext(req, () =>
      this.prisma.tenantSettings.findUniqueOrThrow({
        where: { tenantId: req.tenantContext!.tenantId },
      }),
    );
  }
}
