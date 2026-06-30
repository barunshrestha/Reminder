"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isIos(): boolean {
  return (
    typeof navigator !== "undefined" &&
    /iphone|ipad|ipod/i.test(navigator.userAgent)
  );
}

function isStandalone(): boolean {
  return (
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator &&
        (navigator as Navigator & { standalone?: boolean }).standalone ===
          true))
  );
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      return;
    }
    if (isIos()) {
      setShowIosHint(true);
      return;
    }
    function onBeforeInstall(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  if (dismissed || isStandalone()) {
    return null;
  }

  if (showIosHint) {
    return (
      <Card className="mb-4 border-primary/30 bg-primary/5">
        <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            Install this app: tap <strong>Share</strong> then{" "}
            <strong>Add to Home Screen</strong> for the best mobile experience
            and push alerts.
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setDismissed(true)}
          >
            Dismiss
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!deferredPrompt) {
    return null;
  }

  return (
    <Card className="mb-4 border-primary/30 bg-primary/5">
      <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm">Install Payment Reminder for quick access on this device.</p>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            onClick={async () => {
              await deferredPrompt.prompt();
              setDeferredPrompt(null);
            }}
          >
            Install app
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setDismissed(true)}
          >
            Not now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
