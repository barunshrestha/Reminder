"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  api,
  getReminderConfig,
  listScheduleRuns,
  type ReminderConfig,
  type ScheduleRun,
} from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function SchedulesPage() {
  const [config, setConfig] = useState<ReminderConfig | null>(null);
  const [runs, setRuns] = useState<ScheduleRun[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const reminderConfig = await getReminderConfig();
    setConfig(reminderConfig);
    const history = await listScheduleRuns(reminderConfig.scheduleId);
    setRuns(history);
  }, []);

  useEffect(() => {
    refresh().catch(console.error);
  }, [refresh]);

  async function runSchedule(dryRun: boolean) {
    if (!config) {
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const result = await api<{ queued?: boolean; stats?: unknown }>(
        `/schedules/${config.scheduleId}/run?dryRun=${dryRun}`,
        { method: "POST" },
      );
      setMessage(
        result.queued
          ? "Run queued (Redis worker)"
          : `Run completed: ${JSON.stringify(result.stats ?? result)}`,
      );
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Schedules</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Operations view — trigger runs and review history.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/settings">Edit schedule in Settings</Link>
        </Button>
      </div>

      {config ? (
        <Card>
          <CardHeader>
            <CardTitle>Processing summary</CardTitle>
            <CardDescription>{config.nextRunDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Reminders:{" "}
              <strong>{config.remindersEnabled ? "Enabled" : "Disabled"}</strong>
            </p>
            <p>
              Milestones:{" "}
              <strong>{config.overdueTiers.join(", ")} days past due</strong>
            </p>
            <p>
              Sync before check:{" "}
              <strong>{config.syncBeforeCheck ? "Yes" : "No"}</strong>
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                type="button"
                disabled={busy}
                onClick={() => void runSchedule(true)}
              >
                Run dry-run
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => void runSchedule(false)}
              >
                Run now
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {message ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm">{message}</p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Run history</CardTitle>
          <CardDescription>Last 50 runs for the default processing schedule</CardDescription>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No runs yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Started</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Stats</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell>
                      {new Date(run.startedAt).toLocaleString()}
                    </TableCell>
                    <TableCell>{run.status}</TableCell>
                    <TableCell>{run.dryRun ? "Dry run" : "Live"}</TableCell>
                    <TableCell className="max-w-md truncate text-xs">
                      {run.stats ? JSON.stringify(run.stats) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
