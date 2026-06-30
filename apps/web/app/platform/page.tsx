"use client";

import { DefaultLayout } from "@/layout/DefaultLayout";

export default function PlatformPage() {
  return (
    <DefaultLayout>
      <div className="rounded-sm border border-stroke bg-white p-7.5 dark:border-strokedark dark:bg-boxdark">
        <h1 className="text-title-xl font-bold text-black dark:text-white">Platform admin</h1>
        <p className="mt-4 text-bodydark2">
          Platform administration tools are available via the API at{" "}
          <code className="text-sm">/api/v1/platform/*</code> for users with platform admin access.
        </p>
      </div>
    </DefaultLayout>
  );
}
