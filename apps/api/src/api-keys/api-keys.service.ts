import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { generateApiKey } from "../integration/api-key.guard";

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.apiKey.findMany({
      where: { revokedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });
  }

  async create(name: string) {
    const { plainKey, keyHash, keyPrefix } = generateApiKey();
    const record = await this.prisma.apiKey.create({
      data: { name, keyHash, keyPrefix },
    });
    return {
      id: record.id,
      name: record.name,
      keyPrefix: record.keyPrefix,
      apiKey: plainKey,
      message: "Store this key now; it will not be shown again.",
    };
  }

  async revoke(id: string) {
    const existing = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("API key not found");
    }
    return this.prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }
}
