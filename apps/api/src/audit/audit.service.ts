import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { requireTenantId } from "../tenancy/tenant-context";
import { tenantFilter } from "../tenancy/tenant-scope";

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    eventType: string,
    payload: object,
    explicitTenantId?: string,
  ): Promise<void> {
    const tenantId = explicitTenantId ?? requireTenantId();
    await this.prisma.auditEvent.create({
      data: { eventType, payload, tenantId },
    });
  }

  list(limit: number, eventType?: string) {
    return this.prisma.auditEvent.findMany({
      where: {
        ...tenantFilter(),
        ...(eventType ? { eventType } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }
}
