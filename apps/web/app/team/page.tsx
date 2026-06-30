"use client";

import { useEffect, useState } from "react";
import { DefaultLayout } from "@/layout/DefaultLayout";
import { listMyTenants } from "@/lib/api";

export default function TeamPage() {
  const [tenants, setTenants] = useState<
    Array<{ tenantId: string; role: string; tenant: { name: string; slug: string } }>
  >([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMyTenants()
      .then(setTenants)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load team"));
  }, []);

  return (
    <DefaultLayout>
      <div className="rounded-sm border border-stroke bg-white p-7.5 dark:border-strokedark dark:bg-boxdark">
        <h1 className="text-title-xl font-bold text-black dark:text-white">Team & access</h1>
        {error ? <p className="mt-4 text-meta-1">{error}</p> : null}
        <ul className="mt-6 space-y-3">
          {tenants.map((entry) => (
            <li
              key={entry.tenantId}
              className="flex items-center justify-between border-b border-stroke pb-3 dark:border-strokedark"
            >
              <span className="text-black dark:text-white">{entry.tenant.name}</span>
              <span className="text-sm text-bodydark2">{entry.role}</span>
            </li>
          ))}
        </ul>
      </div>
    </DefaultLayout>
  );
}
