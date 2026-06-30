"use client";

import { useEffect, useState } from "react";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from "@/lib/api";
import {
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
} from "@/lib/push-notifications";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export function NotificationsSettingsCard() {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getNotificationPreferences()
      .then(setPrefs)
      .catch(() => undefined);
  }, []);

  async function enablePush() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await subscribeToPushNotifications();
      const updated = await getNotificationPreferences();
      setPrefs(updated);
      setMessage("Push notifications enabled.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not enable notifications",
      );
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await unsubscribeFromPushNotifications();
      const updated = await getNotificationPreferences();
      setPrefs(updated);
      setMessage("Push notifications disabled.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not disable notifications",
      );
    } finally {
      setBusy(false);
    }
  }

  async function togglePreference(
    key: "importFailures" | "reminderRunFailures",
    value: boolean,
  ) {
    const updated = await updateNotificationPreferences({ [key]: value });
    setPrefs((current) =>
      current
        ? {
            ...current,
            importFailures: updated.importFailures,
            reminderRunFailures: updated.reminderRunFailures,
            pushEnabled: updated.pushEnabled,
          }
        : current,
    );
  }

  if (!prefs) {
    return null;
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Push notifications</CardTitle>
        <CardDescription>
          Get alerts when imports fail or reminder runs encounter errors. On
          iPhone, add this app to your home screen first, then enable push
          here.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!prefs.pushConfigured ? (
          <p className="text-sm text-muted-foreground">
            Push is not configured on this deployment yet.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2 sm:flex-row">
              {prefs.pushEnabled ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="h-11"
                  disabled={busy}
                  onClick={() => void disablePush()}
                >
                  Disable push
                </Button>
              ) : (
                <Button
                  type="button"
                  className="h-11"
                  disabled={busy}
                  onClick={() => void enablePush()}
                >
                  Enable push notifications
                </Button>
              )}
              <p className="text-sm text-muted-foreground sm:self-center">
                {prefs.subscriptionCount} device
                {prefs.subscriptionCount === 1 ? "" : "s"} subscribed
              </p>
            </div>

            <div className="space-y-3">
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 size-4 rounded border-input"
                  checked={prefs.importFailures}
                  disabled={!prefs.pushEnabled}
                  onChange={(event) =>
                    void togglePreference("importFailures", event.target.checked)
                  }
                />
                <span>
                  <Label className="font-normal">Import failures</Label>
                  <p className="text-muted-foreground">
                    Spreadsheet validation errors and scan import failures
                  </p>
                </span>
              </label>
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 size-4 rounded border-input"
                  checked={prefs.reminderRunFailures}
                  disabled={!prefs.pushEnabled}
                  onChange={(event) =>
                    void togglePreference(
                      "reminderRunFailures",
                      event.target.checked,
                    )
                  }
                />
                <span>
                  <Label className="font-normal">Reminder run failures</Label>
                  <p className="text-muted-foreground">
                    Schedule runs that fail or report send errors
                  </p>
                </span>
              </label>
            </div>
          </>
        )}
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
