import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../auth/public.decorator";
import { SKIP_TENANT_KEY } from "./tenancy.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { type TenantContextData } from "./tenant-context";

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const skipTenant = this.reflector.getAllAndOverride<boolean>(
      SKIP_TENANT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic || skipTenant) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: { id: string; email: string };
      tenantContext?: TenantContextData;
      apiKeyId?: string;
      headers: Record<string, string | string[] | undefined>;
    }>();

    if (request.apiKeyId && request.tenantContext?.tenantId) {
      return true;
    }

    if (!request.user?.id) {
      throw new UnauthorizedException();
    }

    const tenantIdHeader = headerValue(request.headers["x-tenant-id"]);
    const tenantSlugHeader = headerValue(request.headers["x-tenant-slug"]);

    let tenantId = tenantIdHeader;
    if (!tenantId && tenantSlugHeader) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { slug: tenantSlugHeader },
        select: { id: true, accountId: true, status: true },
      });
      if (!tenant) {
        throw new ForbiddenException("Tenant not found");
      }
      if (tenant.status !== "active") {
        throw new ForbiddenException("Tenant is not active");
      }
      tenantId = tenant.id;
    }

    let membership = tenantId
      ? await this.prisma.tenantMembership.findUnique({
          where: {
            tenantId_userId: { tenantId, userId: request.user.id },
          },
          include: { tenant: { select: { accountId: true, status: true } } },
        })
      : null;

    if (!membership) {
      membership = await this.prisma.tenantMembership.findFirst({
        where: {
          userId: request.user.id,
          tenant: { status: "active" },
        },
        orderBy: { createdAt: "asc" },
        include: { tenant: { select: { accountId: true, status: true } } },
      });
      tenantId = membership?.tenantId;
    }

    if (!tenantId || !membership || membership.tenant.status !== "active") {
      throw new ForbiddenException("Tenant context required");
    }

    const accountMembership = await this.prisma.accountMembership.findUnique({
      where: {
        accountId_userId: {
          accountId: membership.tenant.accountId,
          userId: request.user.id,
        },
      },
    });

    const ctx: TenantContextData = {
      tenantId,
      accountId: membership.tenant.accountId,
      userId: request.user.id,
      tenantRole: membership.role,
      accountRole: accountMembership?.role,
      mfaVerified: headerValue(request.headers["x-mfa-verified"]) === "true",
      impersonatorId: headerValue(request.headers["x-impersonator-id"]),
    };

    request.tenantContext = ctx;
    return true;
  }
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}
