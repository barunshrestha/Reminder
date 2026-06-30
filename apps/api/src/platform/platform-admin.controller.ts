import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { SkipTenant } from "../tenancy/tenancy.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { PlatformAdminGuard } from "./platform-admin.guard";

@Controller("platform")
@SkipTenant()
@UseGuards(PlatformAdminGuard)
export class PlatformAdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("tenants")
  listTenants() {
    return this.prisma.tenant.findMany({
      include: {
        account: { select: { id: true, name: true } },
        settings: { select: { vendorName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  @Post("impersonate")
  async impersonate(
    @Body() body: { tenant_id: string; user_id: string; admin_user_id: string },
  ) {
    const session = await this.prisma.impersonationSession.create({
      data: {
        adminUserId: body.admin_user_id,
        targetTenantId: body.tenant_id,
        targetUserId: body.user_id,
      },
    });
    return { sessionId: session.id };
  }

  @Get("stats")
  async stats() {
    const [tenants, accounts, users] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.account.count(),
      this.prisma.user.count(),
    ]);
    return { tenants, accounts, users };
  }
}
