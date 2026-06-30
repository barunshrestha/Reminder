import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { requireTenantId } from "../tenancy/tenant-context";
import { tenantFilter, tenantIdempotencyUnique } from "../tenancy/tenant-scope";

const TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async getCached(
    idempotencyKey: string,
    route: string,
  ): Promise<unknown | null> {
    const row = await this.prisma.integrationIdempotency.findUnique({
      where: tenantIdempotencyUnique(idempotencyKey, route),
    });
    if (!row || row.expiresAt < new Date()) {
      return null;
    }
    return row.response;
  }

  async store(
    idempotencyKey: string,
    route: string,
    response: unknown,
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + TTL_MS);
    const tenantId = requireTenantId();
    await this.prisma.integrationIdempotency.upsert({
      where: tenantIdempotencyUnique(idempotencyKey, route),
      create: {
        tenantId,
        idempotencyKey,
        route,
        response: response as object,
        expiresAt,
      },
      update: { response: response as object, expiresAt },
    });
  }
}
