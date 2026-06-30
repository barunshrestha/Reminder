"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type Metrics = {
  invoices: { open: number; paid: number; active: number };
  reminders: { emails_sent: number; documents_generated: number };
  sync: { delta_skip_rate_pct: number | null };
};

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    api<Metrics>("/metrics").then(setMetrics).catch(console.error);
  }, []);

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      {metrics ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">
                Open invoices
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{metrics.invoices.open}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">
                Emails sent
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {metrics.reminders.emails_sent}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">
                Delta skip rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {metrics.sync.delta_skip_rate_pct ?? "—"}%
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      )}
    </AppShell>
  );
}
