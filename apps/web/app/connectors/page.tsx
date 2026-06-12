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

type Connector = {
  id: string;
  name: string;
  enabled: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
};

export default function ConnectorsPage() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [message, setMessage] = useState("");

  function load() {
    api<Connector[]>("/connectors").then(setConnectors).catch(console.error);
  }

  useEffect(() => {
    load();
  }, []);

  async function sync(id: string) {
    setMessage("");
    const stats = await api<Record<string, number>>(`/connectors/${id}/sync`, {
      method: "POST",
    });
    setMessage(`Sync done: ${JSON.stringify(stats)}`);
    load();
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-tight">DB connectors</h1>
      <p className="text-sm text-muted-foreground">
        Read-only SQL against this deployment&apos;s database. Configure via API
        (admin) or seed.
      </p>
      {message ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm">{message}</p>
          </CardContent>
        </Card>
      ) : null}
      {connectors.map((c) => (
        <Card key={c.id}>
          <CardHeader>
            <CardTitle>{c.name}</CardTitle>
            <CardDescription>
              {c.enabled ? "Enabled" : "Disabled"} · Last sync:{" "}
              {c.lastSyncAt ?? "never"} ({c.lastSyncStatus ?? "—"})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" onClick={() => void sync(c.id)}>
              Run sync now
            </Button>
          </CardContent>
        </Card>
      ))}
    </AppShell>
  );
}
