"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError, getAuthConfig, login, ssoLoginUrl } from "@/lib/api";
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
import { Separator } from "@/components/ui/separator";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [oidcEnabled, setOidcEnabled] = useState(false);

  useEffect(() => {
    if (searchParams.get("error") === "sso_failed") {
      setError("Single sign-on failed. Try again or use email and password.");
    }
    getAuthConfig()
      .then((config) => setOidcEnabled(config.oidcEnabled))
      .catch(() => undefined);
  }, [searchParams]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto mt-10 max-w-md px-4 pb-[env(safe-area-inset-bottom)] sm:mt-16 sm:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Payment Reminder</CardTitle>
          <CardDescription>Sign in to your vendor deployment</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {oidcEnabled ? (
            <>
              <Button
                type="button"
                variant="secondary"
                className="h-11 w-full"
                onClick={() => {
                  window.location.href = ssoLoginUrl();
                }}
              >
                Sign in with SSO
              </Button>
              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground">or</span>
                <Separator className="flex-1" />
              </div>
            </>
          ) : null}
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11"
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
            <Button type="submit" className="h-11 w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in with email"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
