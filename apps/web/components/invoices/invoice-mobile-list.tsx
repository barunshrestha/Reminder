"use client";

import Link from "next/link";
import {
  formatCurrency,
  formatDateTime,
  formatDueDate,
  formatStatus,
} from "@/lib/invoice-format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { InvoiceColumnId } from "@/lib/invoice-columns";

export type InvoiceListItem = {
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
  reminderDeliveryMode: "email" | "phone" | "document_only" | "na";
  lastTierSent?: number | null;
  lastReminderSentAt?: string | null;
  paidAt?: string | null;
  comments?: string | null;
};

type InvoiceMobileListProps = {
  invoices: InvoiceListItem[];
  visibleColumns: InvoiceColumnId[];
  onToggleReminder: (invoiceNumber: string, enabled: boolean) => void;
};

export function InvoiceMobileList({
  invoices,
  visibleColumns,
  onToggleReminder,
}: InvoiceMobileListProps) {
  const isVisible = (column: InvoiceColumnId) => visibleColumns.includes(column);
  return (
    <div className="space-y-3 lg:hidden">
      {invoices.map((invoice) => (
        <Card key={invoice.invoiceNumber}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              <Link
                href={`/invoices/${encodeURIComponent(invoice.invoiceNumber)}`}
                className="text-primary hover:underline"
              >
                {invoice.invoiceNumber}
              </Link>
            </CardTitle>
            <p className="text-sm text-muted-foreground">{invoice.clientName}</p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {isVisible("balance") ? (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Balance</span>
                <span>{formatCurrency(invoice.balanceDue)}</span>
              </div>
            ) : null}
            {isVisible("due") ? (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Due</span>
                <span>{formatDueDate(invoice.dueDate)}</span>
              </div>
            ) : null}
            {isVisible("status") ? (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Status</span>
                <span>{formatStatus(invoice.status)}</span>
              </div>
            ) : null}
            {isVisible("email") && invoice.clientEmail ? (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Email</span>
                <span className="truncate text-right">{invoice.clientEmail}</span>
              </div>
            ) : null}
            {isVisible("lastReminder") ? (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Last reminder</span>
                <span>{formatDateTime(invoice.lastReminderSentAt)}</span>
              </div>
            ) : null}
            {isVisible("reminder") ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-11 w-full"
                onClick={() =>
                  onToggleReminder(invoice.invoiceNumber, !invoice.sendReminder)
                }
              >
                Reminders {invoice.sendReminder ? "on" : "off"}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
