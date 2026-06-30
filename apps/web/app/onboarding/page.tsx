"use client";

import { useState } from "react";
import { DefaultLayout } from "@/layout/DefaultLayout";
import { onboardAccount, setStoredTenant } from "@/lib/api";

export default function OnboardingPage() {
  const [accountName, setAccountName] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await onboardAccount({
        account_name: accountName,
        tenant_name: tenantName,
        subdomain,
        plan_code: "starter",
      });
      setStoredTenant(result.tenantId, result.slug);
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onboarding failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DefaultLayout>
      <div className="mx-auto max-w-xl rounded-sm border border-stroke bg-white p-7.5 dark:border-strokedark dark:bg-boxdark">
        <h1 className="text-title-md font-bold text-black dark:text-white">
          Create your organization
        </h1>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <input
            className="w-full rounded border border-stroke px-5 py-3 dark:border-form-strokedark dark:bg-form-input dark:text-white"
            placeholder="Account name"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            required
          />
          <input
            className="w-full rounded border border-stroke px-5 py-3 dark:border-form-strokedark dark:bg-form-input dark:text-white"
            placeholder="Organization name"
            value={tenantName}
            onChange={(e) => setTenantName(e.target.value)}
            required
          />
          <input
            className="w-full rounded border border-stroke px-5 py-3 dark:border-form-strokedark dark:bg-form-input dark:text-white"
            placeholder="Subdomain"
            value={subdomain}
            onChange={(e) => setSubdomain(e.target.value)}
            required
          />
          {error ? <p className="text-sm text-meta-1">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full justify-center rounded-md bg-primary px-10 py-4 font-medium text-white hover:bg-opacity-90 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Continue"}
          </button>
        </form>
      </div>
    </DefaultLayout>
  );
}
