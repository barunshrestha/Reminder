import { SetMetadata } from "@nestjs/common";
import { REQUIRE_TENANT_ROLE_KEY } from "../tenancy/tenancy.decorator";

export const ROLES_KEY = REQUIRE_TENANT_ROLE_KEY;
export const Roles = (...roles: ("admin" | "operator")[]) =>
  SetMetadata(REQUIRE_TENANT_ROLE_KEY, roles);
