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
  clientEmail?: string | null;
  clientPhone?: string | null;
  notificationNumber: number;
  reminderDeliveryMode: "email" | "document_only";
  lastTierSent?: number | null;
  lastReminderSentAt?: string | null;
  paidAt?: string | null;
  comments?: string | null;
};

const STATUS_OPTIONS = ["open", "paid", "closed"] as const;

function formatDate(value?: string | null) {
  if (!value) return "—";
  return value.slice(0, 10);
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function formatDeliveryMode(mode: Invoice["reminderDeliveryMode"]) {
  return mode === "document_only" ? "Document only" : "Email";
}

function formatStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    api<Invoice[]>("/invoices?status=open").then(setInvoices).catch(console.error);
  }, []);

  async function updateStatus(invoiceNumber: string, status: string) {
    const updated = await api<Invoice>(
      `/invoices/${encodeURIComponent(invoiceNumber)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ status }),
      },
    );
    setInvoices((list) =>
      list.map((i) =>
        i.invoiceNumber === invoiceNumber
          ? {
              ...i,
              status: updated.status,
              paidAt: updated.paidAt ?? i.paidAt,
            }
          : i,
      ),
    );
  }

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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notifications</TableHead>
                  <TableHead>Delivery mode</TableHead>
                  <TableHead>Last tier</TableHead>
                  <TableHead>Last reminder</TableHead>
                  <TableHead>Paid at</TableHead>
                  <TableHead>Comment</TableHead>
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
                    <TableCell>{inv.clientEmail || "—"}</TableCell>
                    <TableCell>{inv.clientPhone || "—"}</TableCell>
                    <TableCell>{formatDate(inv.dueDate)}</TableCell>
                    <TableCell>
                      <select
                        value={inv.status}
                        onChange={(e) =>
                          void updateStatus(inv.invoiceNumber, e.target.value)
                        }
                        className="w-full min-w-[6rem] rounded border border-stroke bg-transparent px-2 py-1 text-sm text-black outline-none focus:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {formatStatus(status)}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell>{inv.notificationNumber}</TableCell>
                    <TableCell>
                      {formatDeliveryMode(inv.reminderDeliveryMode)}
                    </TableCell>
                    <TableCell>
                      {inv.lastTierSent ?? "—"}
                    </TableCell>
                    <TableCell>
                      {formatDateTime(inv.lastReminderSentAt)}
                    </TableCell>
                    <TableCell>{formatDateTime(inv.paidAt)}</TableCell>
                    <TableCell
                      className="max-w-[12rem] truncate"
                      title={inv.comments ?? undefined}
                    >
                      {inv.comments || "—"}
                    </TableCell>
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
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
