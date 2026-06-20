"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, getReminderConfig, type ReminderConfig } from "@/lib/api";
import {
  formatCurrency,
  formatDateTime,
  formatDueDate,
  formatStatus,
  parseAmountInput,
  parseDueDateInput,
} from "@/lib/invoice-format";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  reminderDeliveryMode: "email" | "phone" | "document_only" | "na";
  lastTierSent?: number | null;
  lastReminderSentAt?: string | null;
  paidAt?: string | null;
  comments?: string | null;
};

type PatchBody = Record<string, string | number | boolean | null>;

type EditTarget = {
  invoiceNumber: string;
  field:
    | "clientName"
    | "clientEmail"
    | "clientPhone"
    | "balanceDue"
    | "dueDate"
    | "comments";
};

const STATUS_OPTIONS = ["open", "paid", "closed"] as const;

const DELIVERY_MODE_OPTIONS = [
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "document_only", label: "Document Only" },
  { value: "na", label: "N/A" },
] as const;

const cellInputClass =
  "h-8 min-w-[6rem] px-2 py-1 text-sm dark:bg-form-input";

const selectClass =
  "w-full min-w-[6rem] rounded border border-stroke bg-transparent px-2 py-1 text-sm text-black outline-none focus:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white";

function fieldToPatch(field: EditTarget["field"], value: string): PatchBody {
  switch (field) {
    case "clientName":
      return { client_name: value.trim() };
    case "clientEmail":
      return { client_email: value.trim() };
    case "clientPhone":
      return { client_phone: value.trim() };
    case "balanceDue": {
      const amount = parseAmountInput(value);
      if (!amount) {
        throw new Error("Enter a valid amount");
      }
      return { balance_due: amount };
    }
    case "dueDate": {
      const iso = parseDueDateInput(value);
      if (!iso) {
        throw new Error("Enter a valid date (mm/dd/yyyy)");
      }
      return { due_date: iso };
    }
    case "comments":
      return { comments: value };
    default:
      return {};
  }
}

function displayValue(invoice: Invoice, field: EditTarget["field"]) {
  switch (field) {
    case "balanceDue":
      return formatCurrency(invoice.balanceDue);
    case "dueDate":
      return formatDueDate(invoice.dueDate);
    default:
      return invoice[field] || "—";
  }
}

function draftValue(invoice: Invoice, field: EditTarget["field"]) {
  switch (field) {
    case "balanceDue":
      return invoice.balanceDue;
    case "dueDate":
      return formatDueDate(invoice.dueDate) === "—"
        ? ""
        : formatDueDate(invoice.dueDate);
    default:
      return invoice[field] ?? "";
  }
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [overdueTiers, setOverdueTiers] = useState<number[]>([]);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<Invoice[]>("/invoices?status=open").then(setInvoices).catch(console.error);
    getReminderConfig()
      .then((config) => setOverdueTiers(config.overdueTiers))
      .catch(console.error);
  }, []);

  const patchInvoice = useCallback(
    async (invoiceNumber: string, body: PatchBody) => {
      const updated = await api<Invoice>(
        `/invoices/${encodeURIComponent(invoiceNumber)}`,
        {
          method: "PATCH",
          body: JSON.stringify(body),
        },
      );
      setInvoices((list) =>
        list.map((invoice) =>
          invoice.invoiceNumber === invoiceNumber
            ? { ...invoice, ...updated }
            : invoice,
        ),
      );
      return updated;
    },
    [],
  );

  function beginEdit(invoice: Invoice, field: EditTarget["field"]) {
    setError("");
    setEditTarget({ invoiceNumber: invoice.invoiceNumber, field });
    setDraft(String(draftValue(invoice, field)));
  }

  async function commitEdit() {
    if (!editTarget) {
      return;
    }
    try {
      if (editTarget.field === "clientEmail" && draft.trim()) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.trim())) {
          throw new Error("Enter a valid email address");
        }
      }
      const body = fieldToPatch(editTarget.field, draft);
      await patchInvoice(editTarget.invoiceNumber, body);
      setEditTarget(null);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save changes");
    }
  }

  function cancelEdit() {
    setEditTarget(null);
    setDraft("");
    setError("");
  }

  function renderEditableCell(invoice: Invoice, field: EditTarget["field"]) {
    const isEditing =
      editTarget?.invoiceNumber === invoice.invoiceNumber &&
      editTarget.field === field;

    if (isEditing) {
      return (
        <Input
          autoFocus
          type={field === "balanceDue" ? "text" : field === "dueDate" ? "text" : "text"}
          inputMode={field === "balanceDue" ? "decimal" : undefined}
          placeholder={field === "dueDate" ? "mm/dd/yyyy" : undefined}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            void commitEdit();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void commitEdit();
            }
            if (event.key === "Escape") {
              cancelEdit();
            }
          }}
          className={cellInputClass}
        />
      );
    }

    return (
      <button
        type="button"
        onClick={() => beginEdit(invoice, field)}
        className="w-full rounded px-1 py-1 text-left hover:bg-gray-3 dark:hover:bg-meta-4"
      >
        {displayValue(invoice, field)}
      </button>
    );
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
      {error ? (
        <p className="mt-2 text-sm text-meta-1">{error}</p>
      ) : null}
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
                    <TableCell>{renderEditableCell(inv, "clientName")}</TableCell>
                    <TableCell>{renderEditableCell(inv, "clientEmail")}</TableCell>
                    <TableCell>{renderEditableCell(inv, "clientPhone")}</TableCell>
                    <TableCell>{renderEditableCell(inv, "balanceDue")}</TableCell>
                    <TableCell>{renderEditableCell(inv, "dueDate")}</TableCell>
                    <TableCell>
                      <select
                        value={inv.status}
                        onChange={(event) =>
                          void patchInvoice(inv.invoiceNumber, {
                            status: event.target.value,
                          })
                        }
                        className={selectClass}
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {formatStatus(status)}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell>
                      <select
                        value={inv.lastTierSent ?? ""}
                        onChange={(event) =>
                          void patchInvoice(inv.invoiceNumber, {
                            last_tier_sent: event.target.value
                              ? Number(event.target.value)
                              : null,
                          })
                        }
                        className={selectClass}
                      >
                        <option value="">None</option>
                        {overdueTiers.map((tier) => (
                          <option key={tier} value={tier}>
                            {tier} days
                          </option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell>
                      <select
                        value={inv.reminderDeliveryMode}
                        onChange={(event) =>
                          void patchInvoice(inv.invoiceNumber, {
                            reminder_delivery_mode: event.target.value,
                          })
                        }
                        className={`${selectClass} min-w-[8rem]`}
                      >
                        {DELIVERY_MODE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell>{inv.lastTierSent ?? "—"}</TableCell>
                    <TableCell>{formatDateTime(inv.lastReminderSentAt)}</TableCell>
                    <TableCell>{formatDateTime(inv.paidAt)}</TableCell>
                    <TableCell className="max-w-[12rem]">
                      {renderEditableCell(inv, "comments")}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          void patchInvoice(inv.invoiceNumber, {
                            send_reminder: !inv.sendReminder,
                          })
                        }
                      >
                        {inv.sendReminder ? "On" : "Off"}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <select
                        value={inv.emailOptOut ? "yes" : "no"}
                        onChange={(event) =>
                          void patchInvoice(inv.invoiceNumber, {
                            email_opt_out: event.target.value === "yes",
                          })
                        }
                        className={selectClass}
                      >
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </TableCell>
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
