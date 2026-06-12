"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { me } from "@/lib/api";
import { Nav } from "./nav";
import { Skeleton } from "@/components/ui/skeleton";

export function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<{ email: string; role: string } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    me()
      .then((r) => setUser(r.user))
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <>
      <Nav user={user ?? undefined} />
      <main className="mx-auto max-w-6xl space-y-4 p-6">{children}</main>
    </>
  );
}
