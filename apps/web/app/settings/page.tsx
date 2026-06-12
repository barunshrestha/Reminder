"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

type Settings = {
  timezone: string;
  vendorName: string | null;
  vendorPhysicalAddress: string | null;
  digestEmailEnabled: boolean;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api<Settings>("/vendor-settings").then(setSettings).catch(console.error);
  }, []);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!settings) {
      return;
    }
    await api("/vendor-settings", {
      method: "PATCH",
      body: JSON.stringify({
        timezone: settings.timezone,
        vendor_name: settings.vendorName,
        vendor_physical_address: settings.vendorPhysicalAddress,
        digest_email_enabled: settings.digestEmailEnabled,
      }),
    });
    setSaved(true);
  }

  if (!settings) {
    return (
      <AppShell>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-tight">Vendor settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vendorName">Vendor name</Label>
              <Input
                id="vendorName"
                value={settings.vendorName ?? ""}
                onChange={(e) =>
                  setSettings({ ...settings, vendorName: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                value={settings.timezone}
                onChange={(e) =>
                  setSettings({ ...settings, timezone: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Physical address (CAN-SPAM footer)</Label>
              <Textarea
                id="address"
                rows={3}
                value={settings.vendorPhysicalAddress ?? ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    vendorPhysicalAddress: e.target.value,
                  })
                }
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="digest"
                type="checkbox"
                className="size-4 rounded border-input"
                checked={settings.digestEmailEnabled}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    digestEmailEnabled: e.target.checked,
                  })
                }
              />
              <Label htmlFor="digest" className="font-normal">
                Send vendor digest after schedule runs
              </Label>
            </div>
            <Button type="submit">Save</Button>
            {saved ? (
              <p className="text-sm text-muted-foreground">Saved.</p>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </AppShell>
  );
}
