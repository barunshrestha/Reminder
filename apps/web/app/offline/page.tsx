import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function OfflinePage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>You&apos;re offline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Reconnect to manage invoices, imports, and settings.
          </p>
          <Button asChild className="w-full">
            <Link href="/dashboard">Try again</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
