"use client";

import { useEffect, useState } from "react";
import { listMyTenants, setStoredTenant, getStoredTenantId } from "@/lib/api";

export function OrgSwitcher({
  currentTenantId,
}: {
  currentTenantId?: string;
} = {}) {
  const [tenants, setTenants] = useState<
    Array<{ tenantId: string; tenant: { id: string; name: string; slug: string } }>
  >([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    setActiveId(getStoredTenantId() ?? currentTenantId ?? null);
    listMyTenants()
      .then((items) => setTenants(items))
      .catch(() => setTenants([]));
  }, []);

  if (tenants.length <= 1) {
    return null;
  }

  return (
    <select
      className="rounded border border-stroke bg-transparent px-3 py-2 text-sm text-black dark:border-form-strokedark dark:text-white"
      value={activeId ?? ""}
      onChange={(e) => {
        const next = tenants.find((t) => t.tenantId === e.target.value);
        if (!next) return;
        setStoredTenant(next.tenant.id, next.tenant.slug);
        setActiveId(next.tenant.id);
        window.location.reload();
      }}
    >
      {tenants.map((entry) => (
        <option key={entry.tenantId} value={entry.tenantId}>
          {entry.tenant.name}
        </option>
      ))}
    </select>
  );
}
