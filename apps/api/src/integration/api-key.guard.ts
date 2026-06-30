import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash } from "crypto";
import type { Request } from "express";
import { PrismaService } from "../prisma/prisma.service";
import type { TenantContextData } from "../tenancy/tenant-context";

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { apiKeyId?: string; tenantContext?: TenantContextData }
    >();
    const key = extractApiKey(req);
    if (!key) {
      throw new UnauthorizedException("API key required");
    }

    const keyHash = hashApiKey(key);
    const record = await this.prisma.apiKey.findFirst({
      where: { keyHash, revokedAt: null },
      include: { tenant: { select: { accountId: true } } },
    });
    if (!record) {
      throw new UnauthorizedException("Invalid API key");
    }

    await this.prisma.apiKey.update({
      where: { id: record.id },
      data: { lastUsedAt: new Date() },
    });

    req.apiKeyId = record.id;
    req.tenantContext = {
      tenantId: record.tenantId,
      accountId: record.tenant.accountId,
      userId: "api-key",
      tenantRole: "admin",
      mfaVerified: true,
    };
    return true;
  }
}

export function extractApiKey(req: Request): string | null {
  const header = req.header("x-api-key");
  if (header) {
    return header.trim();
  }
  const auth = req.header("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return null;
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateApiKey(): { plainKey: string; keyHash: string; keyPrefix: string } {
  const random = createHash("sha256")
    .update(`${Date.now()}-${Math.random()}`)
    .digest("base64url")
    .slice(0, 32);
  const plainKey = `pr_${random}`;
  return {
    plainKey,
    keyHash: hashApiKey(plainKey),
    keyPrefix: plainKey.slice(0, 12),
  };
}
