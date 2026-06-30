import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { REQUIRE_TENANT_ROLE_KEY } from "../tenancy/tenancy.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<("admin" | "operator")[]>(
      REQUIRE_TENANT_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!roles?.length) {
      return true;
    }
    const request = context.switchToHttp().getRequest<{
      tenantContext?: { tenantRole?: "admin" | "operator" };
    }>();
    const tenantRole = request.tenantContext?.tenantRole;
    if (!tenantRole || !roles.includes(tenantRole)) {
      throw new ForbiddenException("Insufficient role");
    }
    return true;
  }
}
