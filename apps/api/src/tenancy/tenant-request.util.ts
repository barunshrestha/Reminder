import type { Request } from "express";
import type { TenantContextData } from "./tenant-context";
import { runWithTenantContext } from "./tenant-context";

export type TenantRequest = Request & { tenantContext?: TenantContextData };

export function activateTenantContext<T>(
  request: TenantRequest,
  fn: () => T,
): T {
  if (!request.tenantContext) {
    throw new Error("Tenant context not set on request");
  }
  return runWithTenantContext(request.tenantContext, fn);
}
