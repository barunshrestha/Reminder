import { AsyncLocalStorage } from "async_hooks";

export interface TenantContextData {
  tenantId: string;
  accountId: string;
  userId: string;
  tenantRole: "admin" | "operator";
  accountRole?: "owner" | "admin" | "member";
  mfaVerified: boolean;
  impersonatorId?: string;
}

const storage = new AsyncLocalStorage<TenantContextData>();

export function runWithTenantContext<T>(
  ctx: TenantContextData,
  fn: () => T,
): T {
  return storage.run(ctx, fn);
}

export function getTenantContext(): TenantContextData {
  const ctx = storage.getStore();
  if (!ctx) {
    throw new Error("Tenant context not set");
  }
  return ctx;
}

export function getTenantContextOrNull(): TenantContextData | null {
  return storage.getStore() ?? null;
}

export function requireTenantId(): string {
  const ctx = storage.getStore();
  if (!ctx?.tenantId) {
    throw new Error("Tenant context is required");
  }
  return ctx.tenantId;
}

export function requireAccountId(): string {
  return getTenantContext().accountId;
}
