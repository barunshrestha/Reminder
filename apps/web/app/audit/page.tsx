"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AuditEvent = {
  id: string;
  eventType: string;
  createdAt: string;
  payload: unknown;
};

function formatPayload(payload: unknown): string {
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);

  useEffect(() => {
    api<AuditEvent[]>("/audit-events?limit=100").then(setEvents).catch(console.error);
  }, []);

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
      <div className="mt-4 space-y-3 lg:hidden">
        {events.map((event) => (
          <Card key={event.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{event.eventType}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {new Date(event.createdAt).toLocaleString()}
              </p>
            </CardHeader>
            <CardContent>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all text-xs">
                {formatPayload(event.payload)}
              </pre>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="mt-4 hidden lg:block">
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Payload</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>
                    {new Date(event.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>{event.eventType}</TableCell>
                  <TableCell>
                    <pre className="max-h-32 overflow-auto whitespace-pre-wrap text-xs">
                      {formatPayload(event.payload)}
                    </pre>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppShell>
  );
}
