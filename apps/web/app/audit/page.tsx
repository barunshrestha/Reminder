"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
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

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);

  useEffect(() => {
    api<AuditEvent[]>("/audit-events?limit=100").then(setEvents).catch(console.error);
  }, []);

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
      <Card>
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
              {events.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    {new Date(e.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>{e.eventType}</TableCell>
                  <TableCell>
                    <code className="text-xs">
                      {JSON.stringify(e.payload).slice(0, 120)}…
                    </code>
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
