"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  getReminderConfig,
  getReminderTemplates,
  previewReminderTemplate,
  resetReminderTemplate,
  type ReminderConfig,
  type ReminderTemplateItem,
  type ReminderTemplatesResponse,
  updateReminderTemplate,
  updateReminderConfig,
} from "@/lib/api";
import { api } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type VendorSettings = {
  timezone: string;
  vendorName: string | null;
  vendorPhysicalAddress: string | null;
  digestEmailEnabled: boolean;
};

const WEEKDAYS = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

function milestoneBaselineKey(config: {
  tierPreset: ReminderConfig["tierPreset"];
  overdueTiers: number[];
}): string {
  return `${config.tierPreset}:${config.overdueTiers.join(",")}`;
}

export default function SettingsPage() {
  const [vendorSettings, setVendorSettings] = useState<VendorSettings | null>(
    null,
  );
  const [reminderConfig, setReminderConfig] = useState<ReminderConfig | null>(
    null,
  );
  const [customTierInput, setCustomTierInput] = useState("");
  const [savedGeneral, setSavedGeneral] = useState(false);
  const [savedReminders, setSavedReminders] = useState(false);
  const [savedMilestones, setSavedMilestones] = useState(false);
  const [milestoneBaseline, setMilestoneBaseline] = useState("");
  const [milestoneError, setMilestoneError] = useState("");
  const [savingMilestones, setSavingMilestones] = useState(false);
  const [templatesData, setTemplatesData] =
    useState<ReminderTemplatesResponse | null>(null);
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [templateSubject, setTemplateSubject] = useState("");
  const [templateBody, setTemplateBody] = useState("");
  const [templatePreviewHtml, setTemplatePreviewHtml] = useState<string | null>(
    null,
  );
  const [savedTemplate, setSavedTemplate] = useState(false);
  const [templateError, setTemplateError] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api<VendorSettings>("/vendor-settings"),
      getReminderConfig(),
      getReminderTemplates(),
    ])
      .then(([vendor, reminders, templates]) => {
        setVendorSettings(vendor);
        setReminderConfig(reminders);
        setMilestoneBaseline(milestoneBaselineKey(reminders));
        setTemplatesData(templates);
        const firstTier = reminders.overdueTiers[0] ?? null;
        setSelectedTier(firstTier);
        if (firstTier !== null) {
          const item = templates.templates.find((t) => t.tierDays === firstTier);
          if (item) {
            setTemplateSubject(item.subject);
            setTemplateBody(item.bodyHtml);
          }
        }
      })
      .catch(console.error);
  }, []);

  const loadTemplateForTier = useCallback(
    (tier: number, templates: ReminderTemplateItem[]) => {
      const item = templates.find((t) => t.tierDays === tier);
      if (item) {
        setTemplateSubject(item.subject);
        setTemplateBody(item.bodyHtml);
        setTemplatePreviewHtml(null);
        setSavedTemplate(false);
        setTemplateError("");
      }
    },
    [],
  );

  useEffect(() => {
    if (!reminderConfig || !templatesData) {
      return;
    }
    getReminderTemplates()
      .then((fresh) => {
        setTemplatesData(fresh);
        const tiers = reminderConfig.overdueTiers;
        const tier =
          selectedTier !== null && tiers.includes(selectedTier)
            ? selectedTier
            : (tiers[0] ?? null);
        setSelectedTier(tier);
        if (tier !== null) {
          const item = fresh.templates.find((t) => t.tierDays === tier);
          if (item) {
            loadTemplateForTier(tier, fresh.templates);
          }
        }
      })
      .catch(console.error);
    // Reload templates when milestone tiers change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reminderConfig?.overdueTiers.join(","), milestoneBaseline]);

  async function saveGeneral(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!vendorSettings) {
      return;
    }
    setError("");
    await api("/vendor-settings", {
      method: "PATCH",
      body: JSON.stringify({
        timezone: vendorSettings.timezone,
        vendor_name: vendorSettings.vendorName,
        vendor_physical_address: vendorSettings.vendorPhysicalAddress,
        digest_email_enabled: vendorSettings.digestEmailEnabled,
      }),
    });
    setSavedGeneral(true);
  }

  async function persistMilestones(
    config: Pick<ReminderConfig, "tierPreset" | "overdueTiers">,
  ) {
    setMilestoneError("");
    setSavedMilestones(false);
    setSavingMilestones(true);
    try {
      const updated = await updateReminderConfig({
        tierPreset: config.tierPreset,
        overdueTiers: config.overdueTiers,
      });
      setReminderConfig((prev) => (prev ? { ...prev, ...updated } : updated));
      setMilestoneBaseline(milestoneBaselineKey(updated));
      setSavedMilestones(true);
      return updated;
    } catch (err) {
      setMilestoneError(
        err instanceof Error ? err.message : "Failed to save milestones",
      );
      throw err;
    } finally {
      setSavingMilestones(false);
    }
  }

  async function saveMilestones() {
    if (!reminderConfig) {
      return;
    }
    await persistMilestones({
      tierPreset: reminderConfig.tierPreset,
      overdueTiers: reminderConfig.overdueTiers,
    });
  }

  async function saveReminders(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!reminderConfig) {
      return;
    }
    setError("");
    try {
      const updated = await updateReminderConfig({
        tierPreset: reminderConfig.tierPreset,
        overdueTiers: reminderConfig.overdueTiers,
        remindersEnabled: reminderConfig.remindersEnabled,
        processingPreset: reminderConfig.processingPreset,
        weeklyDay: reminderConfig.weeklyDay,
        runHour: reminderConfig.runHour,
        timezone: reminderConfig.timezone,
        syncBeforeCheck: reminderConfig.syncBeforeCheck,
      });
      setReminderConfig(updated);
      setMilestoneBaseline(milestoneBaselineKey(updated));
      setSavedMilestones(true);
      setSavedReminders(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save reminders");
    }
  }

  function applyTierPreset(preset: ReminderConfig["tierPreset"]) {
    if (!reminderConfig) {
      return;
    }
    const tiers =
      preset === "standard"
        ? [15, 30, 45, 60]
        : preset === "gentle"
          ? [30, 60]
          : reminderConfig.overdueTiers;
    setReminderConfig({ ...reminderConfig, tierPreset: preset, overdueTiers: tiers });
    setSavedMilestones(false);
  }

  async function addCustomTier() {
    if (!reminderConfig) {
      return;
    }
    const day = parseInt(customTierInput, 10);
    if (!Number.isInteger(day) || day < 1) {
      setMilestoneError("Enter a whole number of days (1 or greater).");
      return;
    }
    if (reminderConfig.overdueTiers.includes(day)) {
      setMilestoneError(`Milestone ${day} days is already configured.`);
      return;
    }
    const tiers = [...new Set([...reminderConfig.overdueTiers, day])].sort(
      (a, b) => a - b,
    );
    const nextConfig = {
      ...reminderConfig,
      tierPreset: "custom" as const,
      overdueTiers: tiers,
    };
    setReminderConfig(nextConfig);
    setCustomTierInput("");
    setSelectedTier(day);
    await persistMilestones({
      tierPreset: nextConfig.tierPreset,
      overdueTiers: nextConfig.overdueTiers,
    });
  }

  async function removeTier(day: number) {
    if (!reminderConfig) {
      return;
    }
    const tiers = reminderConfig.overdueTiers.filter((t) => t !== day);
    if (tiers.length === 0) {
      setMilestoneError("At least one milestone is required.");
      return;
    }
    const nextConfig = {
      ...reminderConfig,
      tierPreset: "custom" as const,
      overdueTiers: tiers,
    };
    setReminderConfig(nextConfig);
    await persistMilestones({
      tierPreset: nextConfig.tierPreset,
      overdueTiers: nextConfig.overdueTiers,
    });
  }

  function selectTemplateTier(tier: number) {
    if (!templatesData) {
      return;
    }
    setSelectedTier(tier);
    loadTemplateForTier(tier, templatesData.templates);
  }

  function insertMergeField(field: string) {
    const token = `{{${field}}}`;
    const textarea = bodyRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const next =
        templateBody.slice(0, start) + token + templateBody.slice(end);
      setTemplateBody(next);
      requestAnimationFrame(() => {
        textarea.focus();
        const pos = start + token.length;
        textarea.setSelectionRange(pos, pos);
      });
    } else {
      setTemplateBody((prev) => prev + token);
    }
  }

  async function runTemplatePreview() {
    if (selectedTier === null) {
      return;
    }
    setPreviewLoading(true);
    setTemplateError("");
    try {
      const result = await previewReminderTemplate({
        tierDays: selectedTier,
        subject: templateSubject,
        bodyHtml: templateBody,
      });
      setTemplatePreviewHtml(result.html);
    } catch (err) {
      setTemplateError(
        err instanceof Error ? err.message : "Preview failed",
      );
    } finally {
      setPreviewLoading(false);
    }
  }

  async function saveTemplate() {
    if (selectedTier === null) {
      return;
    }
    setTemplateError("");
    try {
      const updated = await updateReminderTemplate(selectedTier, {
        subject: templateSubject,
        bodyHtml: templateBody,
      });
      setTemplatesData((prev) => {
        if (!prev) {
          return prev;
        }
        const templates = prev.templates.map((t) =>
          t.tierDays === updated.tierDays ? updated : t,
        );
        return { ...prev, templates };
      });
      setSavedTemplate(true);
      setTemplatePreviewHtml(null);
    } catch (err) {
      setTemplateError(
        err instanceof Error ? err.message : "Failed to save template",
      );
    }
  }

  async function resetTemplate() {
    if (selectedTier === null) {
      return;
    }
    setTemplateError("");
    try {
      const updated = await resetReminderTemplate(selectedTier);
      setTemplateSubject(updated.subject);
      setTemplateBody(updated.bodyHtml);
      setTemplatesData((prev) => {
        if (!prev) {
          return prev;
        }
        const templates = prev.templates.map((t) =>
          t.tierDays === updated.tierDays ? updated : t,
        );
        return { ...prev, templates };
      });
      setTemplatePreviewHtml(null);
      setSavedTemplate(false);
    } catch (err) {
      setTemplateError(
        err instanceof Error ? err.message : "Failed to reset template",
      );
    }
  }

  const selectedTemplateItem =
    selectedTier !== null && templatesData
      ? templatesData.templates.find((t) => t.tierDays === selectedTier)
      : undefined;

  const milestonesDirty =
    reminderConfig !== null &&
    milestoneBaselineKey(reminderConfig) !== milestoneBaseline;

  if (!vendorSettings || !reminderConfig || !templatesData) {
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

      <form onSubmit={saveReminders} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Reminder rules</CardTitle>
            <CardDescription>
              Clients are reminded once they reach each milestone{" "}
              <strong>days past due</strong>. Delivery channel (email / SMS /
              document) is set per invoice.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tierPreset">Reminder milestones</Label>
              <Select
                value={reminderConfig.tierPreset}
                onValueChange={(value) =>
                  applyTierPreset(value as ReminderConfig["tierPreset"])
                }
              >
                <SelectTrigger id="tierPreset">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">
                    Standard (15, 30, 45, 60 days)
                  </SelectItem>
                  <SelectItem value="gentle">Gentle (30, 60 days)</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap gap-2">
              {reminderConfig.overdueTiers.map((tier) => (
                <Badge key={tier} variant="secondary" className="gap-1">
                  {tier} days
                  {reminderConfig.tierPreset === "custom" ? (
                    <button
                      type="button"
                      className="ml-1 text-muted-foreground hover:text-foreground"
                      onClick={() => removeTier(tier)}
                      aria-label={`Remove ${tier} day tier`}
                    >
                      ×
                    </button>
                  ) : null}
                </Badge>
              ))}
            </div>

            {reminderConfig.tierPreset === "custom" ? (
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-2">
                  <Label htmlFor="customTier">Add milestone (days past due)</Label>
                  <Input
                    id="customTier"
                    type="number"
                    min={1}
                    value={customTierInput}
                    onChange={(e) => {
                      setCustomTierInput(e.target.value);
                      setMilestoneError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void addCustomTier();
                      }
                    }}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={savingMilestones}
                  onClick={() => void addCustomTier()}
                >
                  {savingMilestones ? "Saving…" : "Add and save"}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Choose <strong>Custom</strong> to add milestones beyond the
                preset lists.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t pt-4">
              <Button
                type="button"
                disabled={!milestonesDirty || savingMilestones}
                onClick={() => void saveMilestones()}
              >
                {savingMilestones ? "Saving…" : "Save milestones"}
              </Button>
              {milestonesDirty ? (
                <p className="text-sm text-amber-600 dark:text-amber-500">
                  Unsaved milestone changes — save before leaving this page.
                </p>
              ) : savedMilestones ? (
                <p className="text-sm text-muted-foreground">Milestones saved.</p>
              ) : null}
              {milestoneError ? (
                <p className="text-sm text-destructive">{milestoneError}</p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Email templates</CardTitle>
              {selectedTemplateItem ? (
                <Badge variant={selectedTemplateItem.isCustom ? "default" : "secondary"}>
                  {selectedTemplateItem.isCustom ? "Custom" : "System default"}
                </Badge>
              ) : null}
            </div>
            <CardDescription>
              Customize subject and message for each overdue milestone. The same
              copy is used for email and document-only reminders. Greeting,
              invoice details, and footer are added automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="templateTier">Milestone</Label>
              <Select
                value={selectedTier !== null ? String(selectedTier) : undefined}
                onValueChange={(value) => selectTemplateTier(parseInt(value, 10))}
              >
                <SelectTrigger id="templateTier">
                  <SelectValue placeholder="Select milestone" />
                </SelectTrigger>
                <SelectContent>
                  {reminderConfig.overdueTiers.map((tier) => (
                    <SelectItem key={tier} value={String(tier)}>
                      {tier} days past due
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="templateSubject">Subject</Label>
              <Input
                id="templateSubject"
                value={templateSubject}
                onChange={(e) => {
                  setTemplateSubject(e.target.value);
                  setSavedTemplate(false);
                }}
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="templateBody">Message body</Label>
              <Textarea
                id="templateBody"
                ref={bodyRef}
                rows={8}
                value={templateBody}
                onChange={(e) => {
                  setTemplateBody(e.target.value);
                  setSavedTemplate(false);
                }}
                maxLength={5000}
              />
              <p className="text-sm text-muted-foreground">
                Merge fields — click to insert:
              </p>
              <div className="flex flex-wrap gap-1">
                {templatesData.mergeFields.map((field) => (
                  <Button
                    key={field}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 font-mono text-xs"
                    onClick={() => insertMergeField(field)}
                  >
                    {`{{${field}}}`}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={previewLoading || selectedTier === null}
                onClick={runTemplatePreview}
              >
                {previewLoading ? "Previewing…" : "Preview"}
              </Button>
              <Button
                type="button"
                disabled={selectedTier === null}
                onClick={() => void saveTemplate()}
              >
                Save template
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={selectedTier === null}
                onClick={() => void resetTemplate()}
              >
                Reset to default
              </Button>
            </div>

            {templatePreviewHtml ? (
              <div className="space-y-2">
                <Label>Preview</Label>
                <div
                  className="rounded-md border bg-muted/30 p-4 text-sm [&_ul]:list-disc [&_ul]:pl-5"
                  dangerouslySetInnerHTML={{ __html: templatePreviewHtml }}
                />
              </div>
            ) : null}

            {savedTemplate ? (
              <p className="text-sm text-muted-foreground">Template saved.</p>
            ) : null}
            {templateError ? (
              <p className="text-sm text-destructive">{templateError}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Processing schedule</CardTitle>
            <CardDescription>
              How often the system checks invoices and sends due reminders.{" "}
              {reminderConfig.nextRunDescription}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                id="remindersEnabled"
                type="checkbox"
                className="size-4 rounded border-input"
                checked={reminderConfig.remindersEnabled}
                onChange={(e) =>
                  setReminderConfig({
                    ...reminderConfig,
                    remindersEnabled: e.target.checked,
                  })
                }
              />
              <Label htmlFor="remindersEnabled" className="font-normal">
                Reminders enabled
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="processingPreset">Check frequency</Label>
              <Select
                value={reminderConfig.processingPreset}
                onValueChange={(value) =>
                  setReminderConfig({
                    ...reminderConfig,
                    processingPreset: value as ReminderConfig["processingPreset"],
                  })
                }
              >
                <SelectTrigger id="processingPreset">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="manual">Manual only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {reminderConfig.processingPreset === "weekly" ? (
              <div className="space-y-2">
                <Label htmlFor="weeklyDay">Day of week</Label>
                <Select
                  value={String(reminderConfig.weeklyDay)}
                  onValueChange={(value) =>
                    setReminderConfig({
                      ...reminderConfig,
                      weeklyDay: parseInt(value, 10),
                    })
                  }
                >
                  <SelectTrigger id="weeklyDay">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEKDAYS.map((day) => (
                      <SelectItem key={day.value} value={day.value}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {reminderConfig.processingPreset !== "manual" ? (
              <div className="space-y-2">
                <Label htmlFor="runHour">Run time (hour, 0–23)</Label>
                <Input
                  id="runHour"
                  type="number"
                  min={0}
                  max={23}
                  value={reminderConfig.runHour}
                  onChange={(e) =>
                    setReminderConfig({
                      ...reminderConfig,
                      runHour: parseInt(e.target.value, 10) || 0,
                    })
                  }
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="reminderTimezone">Timezone</Label>
              <Input
                id="reminderTimezone"
                value={reminderConfig.timezone}
                onChange={(e) =>
                  setReminderConfig({
                    ...reminderConfig,
                    timezone: e.target.value,
                  })
                }
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="syncBeforeCheck"
                type="checkbox"
                className="size-4 rounded border-input"
                checked={reminderConfig.syncBeforeCheck}
                onChange={(e) =>
                  setReminderConfig({
                    ...reminderConfig,
                    syncBeforeCheck: e.target.checked,
                  })
                }
              />
              <Label htmlFor="syncBeforeCheck" className="font-normal">
                Sync data from connectors before checking
              </Label>
            </div>

            <p className="text-sm text-muted-foreground">
              Manual runs and history:{" "}
              <Link href="/schedules" className="underline underline-offset-4">
                Schedules page
              </Link>
            </p>

            <Button type="submit">Save reminder settings</Button>
            {savedReminders ? (
              <p className="text-sm text-muted-foreground">Reminder settings saved.</p>
            ) : null}
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
          </CardContent>
        </Card>
      </form>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>General configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveGeneral} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vendorName">Vendor name</Label>
              <Input
                id="vendorName"
                value={vendorSettings.vendorName ?? ""}
                onChange={(e) =>
                  setVendorSettings({
                    ...vendorSettings,
                    vendorName: e.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone (general)</Label>
              <Input
                id="timezone"
                value={vendorSettings.timezone}
                onChange={(e) =>
                  setVendorSettings({
                    ...vendorSettings,
                    timezone: e.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Physical address (CAN-SPAM footer)</Label>
              <Textarea
                id="address"
                rows={3}
                value={vendorSettings.vendorPhysicalAddress ?? ""}
                onChange={(e) =>
                  setVendorSettings({
                    ...vendorSettings,
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
                checked={vendorSettings.digestEmailEnabled}
                onChange={(e) =>
                  setVendorSettings({
                    ...vendorSettings,
                    digestEmailEnabled: e.target.checked,
                  })
                }
              />
              <Label htmlFor="digest" className="font-normal">
                Send vendor digest after schedule runs
              </Label>
            </div>
            <Button type="submit">Save general settings</Button>
            {savedGeneral ? (
              <p className="text-sm text-muted-foreground">General settings saved.</p>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </AppShell>
  );
}
