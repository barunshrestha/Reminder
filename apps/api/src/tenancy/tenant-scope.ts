import { requireTenantId } from "./tenant-context";

export function scopedTenantId(explicit?: string): string {
  return explicit ?? requireTenantId();
}

export function tenantFilter(explicitTenantId?: string) {
  return { tenantId: scopedTenantId(explicitTenantId) };
}

export function regionalStorageKey(
  tenantId: string,
  region: string,
  ...parts: string[]
): string {
  return [region, tenantId, ...parts].join("/");
}

export function tenantInvoiceUnique(invoiceNumber: string, tenantId?: string) {
  return {
    tenantId_invoiceNumber: {
      tenantId: scopedTenantId(tenantId),
      invoiceNumber,
    },
  };
}

export function tenantMilestoneUnique(tierDays: number, tenantId?: string) {
  return {
    tenantId_tierDays: {
      tenantId: scopedTenantId(tenantId),
      tierDays,
    },
  };
}

export function tenantSpreadsheetUploadUnique(
  originalFilename: string,
  tenantId?: string,
) {
  return {
    tenantId_originalFilename: {
      tenantId: scopedTenantId(tenantId),
      originalFilename,
    },
  };
}

export function tenantIdempotencyUnique(
  idempotencyKey: string,
  route: string,
  tenantId?: string,
) {
  return {
    tenantId_idempotencyKey_route: {
      tenantId: scopedTenantId(tenantId),
      idempotencyKey,
      route,
    },
  };
}
