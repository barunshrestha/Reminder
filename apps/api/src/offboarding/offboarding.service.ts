import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { requireTenantId } from "../tenancy/tenant-context";

@Injectable()
export class OffboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async requestExport(format = "csv") {
    const tenantId = requireTenantId();
    return this.prisma.tenantExportJob.create({
      data: { tenantId, format, status: "pending" },
    });
  }

  async listExportJobs() {
    return this.prisma.tenantExportJob.findMany({
      where: { tenantId: requireTenantId() },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  }

  async suspendTenant() {
    const tenantId = requireTenantId();
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: "suspended" },
    });
  }

  async deleteTenant() {
    const tenantId = requireTenantId();
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: "deleted" },
    });
  }
}
