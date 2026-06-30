import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { requireTenantId } from "../tenancy/tenant-context";

@Injectable()
export class BrandingService {
  constructor(private readonly prisma: PrismaService) {}

  get() {
    return this.prisma.tenantBranding.findUniqueOrThrow({
      where: { tenantId: requireTenantId() },
    });
  }

  update(data: {
    logo_url?: string;
    primary_color?: string;
    accent_color?: string;
  }) {
    return this.prisma.tenantBranding.update({
      where: { tenantId: requireTenantId() },
      data: {
        logoUrl: data.logo_url,
        primaryColor: data.primary_color,
        accentColor: data.accent_color,
      },
    });
  }
}
