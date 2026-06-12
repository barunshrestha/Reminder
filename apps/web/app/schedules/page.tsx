"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Schedule = {
  id: string;
  name: string;
  enabled: boolean;
  dryRun: boolean;
  cronExpression: string | null;
};

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    api<Schedule[]>("/schedules").then(setSchedules).catch(console.error);
  }, []);

  async function runSchedule(id: string, dryRun: boolean) {
    setMessage("");
    const result = await api<{ queued?: boolean; stats?: unknown }>(
      `/schedules/${id}/run?dryRun=${dryRun}`,
      { method: "POST" },
    );
    setMessage(
      result.queued
        ? "Run queued (Redis worker)"
        : `Run completed: ${JSON.stringify(result.stats ?? result)}`,
    );
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-tight">Schedules</h1>
      {message ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm">{message}</p>
          </CardContent>
        </Card>
      ) : null}
      {schedules.map((s) => (
        <Card key={s.id}>
          <CardHeader>
            <CardTitle>{s.name}</CardTitle>
            <CardDescription>
              {s.cronExpression ?? "RRULE"} · {s.enabled ? "Enabled" : "Disabled"}{" "}
              · {s.dryRun ? "Dry run" : "Live"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void runSchedule(s.id, true)}>
              Run dry-run
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void runSchedule(s.id, false)}
            >
              Run live
            </Button>
          </CardContent>
        </Card>
      ))}
    </AppShell>
  );
}
