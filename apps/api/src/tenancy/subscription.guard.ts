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
export class SubscriptionGuard implements CanActivate {
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
      tenantContext?: { accountId: string };
      apiKeyId?: string;
    }>();
    if (request.apiKeyId) {
      return true;
    }
    const accountId = request.tenantContext?.accountId;
    if (!accountId) {
      return true;
    }

    const subscription = await this.prisma.subscription.findFirst({
      where: {
        accountId,
        status: { in: ["trialing", "active"] },
      },
    });

    if (!subscription) {
      throw new ForbiddenException("Active subscription required");
    }

    return true;
  }
}
