import { SetMetadata } from "@nestjs/common";

export const SKIP_TENANT_KEY = "skipTenant";
export const SkipTenant = () => SetMetadata(SKIP_TENANT_KEY, true);

export const REQUIRE_TENANT_ROLE_KEY = "requireTenantRole";
export const RequireTenantRole = (...roles: ("admin" | "operator")[]) =>
  SetMetadata(REQUIRE_TENANT_ROLE_KEY, roles);
