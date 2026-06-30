"use client";

import { useEffect, useState } from "react";
import { DefaultLayout } from "@/layout/DefaultLayout";
import { getBillingSubscription, getBillingUsage } from "@/lib/api";

export default function BillingPage() {
  const [subscription, setSubscription] = useState<Record<string, unknown> | null>(null);
  const [usage, setUsage] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getBillingSubscription(), getBillingUsage()])
      .then(([sub, use]) => {
        setSubscription(sub as Record<string, unknown>);
        setUsage(use as Record<string, unknown>);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load billing"));
  }, []);

  return (
    <DefaultLayout>
      <div className="space-y-6">
        <h1 className="text-title-xl font-bold text-black dark:text-white">Billing</h1>
        {error ? <p className="text-meta-1">{error}</p> : null}
        <div className="rounded-sm border border-stroke bg-white p-7.5 dark:border-strokedark dark:bg-boxdark">
          <h2 className="text-title-sm font-semibold text-black dark:text-white">Subscription</h2>
          <pre className="mt-4 overflow-x-auto text-sm text-bodydark2">
            {JSON.stringify(subscription, null, 2)}
          </pre>
        </div>
        <div className="rounded-sm border border-stroke bg-white p-7.5 dark:border-strokedark dark:bg-boxdark">
          <h2 className="text-title-sm font-semibold text-black dark:text-white">Usage</h2>
          <pre className="mt-4 overflow-x-auto text-sm text-bodydark2">
            {JSON.stringify(usage, null, 2)}
          </pre>
        </div>
      </div>
    </DefaultLayout>
  );
}
