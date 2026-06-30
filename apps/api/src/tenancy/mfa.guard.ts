import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../auth/public.decorator";
import { SKIP_TENANT_KEY } from "./tenancy.decorator";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class MfaGuard implements CanActivate {
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
      user?: { id: string };
      tenantContext?: { mfaVerified: boolean; impersonatorId?: string };
      apiKeyId?: string;
    }>();

    if (request.apiKeyId) {
      return true;
    }

    if (request.tenantContext?.impersonatorId) {
      return true;
    }

    const userId = request.user?.id;
    if (!userId) {
      return true;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true },
    });

    if (!user?.mfaEnabled) {
      return true;
    }

    if (!request.tenantContext?.mfaVerified) {
      throw new ForbiddenException("MFA verification required");
    }

    return true;
  }
}
