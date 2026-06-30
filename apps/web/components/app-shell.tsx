"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { me, setStoredTenant } from "@/lib/api";
import { DefaultLayout } from "@/layout/DefaultLayout";
import { Skeleton } from "@/components/ui/skeleton";

export function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    me()
      .then((result) => {
        if (result.user.tenantId) {
          setStoredTenant(result.user.tenantId, result.user.tenantSlug);
        }
      })
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-12 w-full rounded-sm" />
        <Skeleton className="h-9 w-48 rounded-sm" />
        <Skeleton className="h-40 w-full rounded-sm" />
      </div>
    );
  }

  return <DefaultLayout>{children}</DefaultLayout>;
}
