import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async getCached(
    idempotencyKey: string,
    route: string,
  ): Promise<unknown | null> {
    const row = await this.prisma.integrationIdempotency.findUnique({
      where: {
        idempotencyKey_route: { idempotencyKey, route },
      },
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
    await this.prisma.integrationIdempotency.upsert({
      where: {
        idempotencyKey_route: { idempotencyKey, route },
      },
      create: { idempotencyKey, route, response: response as object, expiresAt },
      update: { response: response as object, expiresAt },
    });
  }
}
