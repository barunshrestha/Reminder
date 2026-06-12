"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Invoice = {
  invoiceNumber: string;
  clientName: string;
  balanceDue: string;
  dueDate: string;
  status: string;
  sendReminder: boolean;
  emailOptOut: boolean;
  daysBehind?: number;
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    api<Invoice[]>("/invoices?status=open").then(setInvoices).catch(console.error);
  }, []);

  async function toggleSend(invoiceNumber: string, current: boolean) {
    await api(`/invoices/${encodeURIComponent(invoiceNumber)}`, {
      method: "PATCH",
      body: JSON.stringify({ send_reminder: !current }),
    });
    setInvoices((list) =>
      list.map((i) =>
        i.invoiceNumber === invoiceNumber
          ? { ...i, sendReminder: !current }
          : i,
      ),
    );
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Reminders</TableHead>
                <TableHead>Opt-out</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.invoiceNumber}>
                  <TableCell>
                    <Link
                      href={`/invoices/${encodeURIComponent(inv.invoiceNumber)}`}
                      className="text-primary hover:underline"
                    >
                      {inv.invoiceNumber}
                    </Link>
                  </TableCell>
                  <TableCell>{inv.clientName}</TableCell>
                  <TableCell>{inv.balanceDue}</TableCell>
                  <TableCell>{inv.dueDate?.slice(0, 10)}</TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        void toggleSend(inv.invoiceNumber, inv.sendReminder)
                      }
                    >
                      {inv.sendReminder ? "On" : "Off"}
                    </Button>
                  </TableCell>
                  <TableCell>{inv.emailOptOut ? "Yes" : "No"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppShell>
  );
}
