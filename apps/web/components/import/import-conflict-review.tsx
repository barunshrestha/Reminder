"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ImportResolution, ImportRowResult } from "@/lib/api";

const FIELD_LABELS: Record<string, string> = {
  client_name: "Client",
  total_amount: "Total",
  balance_due: "Balance due",
  due_date: "Due date",
  date_of_service: "Date of service",
  client_email: "Email",
  client_phone: "Phone",
  comments: "Comments",
  send_reminder: "Send reminder",
  external_client_id: "External client ID",
  status: "Status",
  email_opt_out: "Email opt-out",
  consent_email: "Consent email",
  reminder_delivery_mode: "Delivery mode",
};

type ImportConflictReviewProps = {
  batchId: string;
  rows: ImportRowResult[];
  summary?: {
    new: number;
    unchanged: number;
    conflict: number;
  };
  busy?: boolean;
  onCommit: (
    decisions: Array<{ importRowId: string; resolution: ImportResolution }>,
  ) => Promise<void>;
  onCancel?: () => void;
};

export function ImportConflictReview({
  batchId,
  rows,
  summary,
  busy,
  onCommit,
  onCancel,
}: ImportConflictReviewProps) {
  const conflicts = useMemo(
    () => rows.filter((row) => row.status === "conflict"),
    [rows],
  );

  const [decisions, setDecisions] = useState<
    Record<string, ImportResolution | undefined>
  >({});

  function setDecision(importRowId: string, resolution: ImportResolution) {
    setDecisions((prev) => ({ ...prev, [importRowId]: resolution }));
  }

  function setAll(resolution: ImportResolution) {
    const next: Record<string, ImportResolution> = {};
    for (const row of conflicts) {
      next[row.importRowId] = resolution;
    }
    setDecisions(next);
  }

  async function handleCommit() {
    const payload = conflicts
      .map((row) => ({
        importRowId: row.importRowId,
        resolution: decisions[row.importRowId],
      }))
      .filter(
        (item): item is { importRowId: string; resolution: ImportResolution } =>
          Boolean(item.resolution),
      );
    await onCommit(payload);
  }

  const allResolved = conflicts.every((row) => decisions[row.importRowId]);

  if (conflicts.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review invoice conflicts</CardTitle>
        <p className="text-sm text-muted-foreground">
          Batch {batchId.slice(0, 8)}… — {conflicts.length} row
          {conflicts.length === 1 ? "" : "s"} need your decision before data is
          updated.
        </p>
        {summary ? (
          <div className="flex flex-wrap gap-2 pt-2">
            <Badge variant="secondary">{summary.new} new imported</Badge>
            <Badge variant="outline">{summary.unchanged} unchanged</Badge>
            <Badge variant="destructive">{summary.conflict} conflicts</Badge>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => setAll("update")}
          >
            Update all conflicts
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => setAll("keep")}
          >
            Keep all existing
          </Button>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Row</TableHead>
                <TableHead>Invoice #</TableHead>
                <TableHead>Changed fields</TableHead>
                <TableHead>Existing</TableHead>
                <TableHead>Incoming</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {conflicts.map((row) => (
                <TableRow key={row.importRowId}>
                  <TableCell>{row.rowNumber}</TableCell>
                  <TableCell className="font-medium">
                    {row.invoiceNumber}
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.changedFields
                      .map((f) => FIELD_LABELS[f] ?? f)
                      .join(", ")}
                  </TableCell>
                  <TableCell className="max-w-[12rem] text-xs">
                    {row.changedFields.map((field) => (
                      <div key={field}>
                        <span className="text-muted-foreground">
                          {FIELD_LABELS[field] ?? field}:
                        </span>{" "}
                        {formatValue(row.existing?.[field])}
                      </div>
                    ))}
                  </TableCell>
                  <TableCell className="max-w-[12rem] text-xs">
                    {row.changedFields.map((field) => (
                      <div key={field}>
                        <span className="text-muted-foreground">
                          {FIELD_LABELS[field] ?? field}:
                        </span>{" "}
                        {formatValue(row.incoming[field])}
                      </div>
                    ))}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant={
                          decisions[row.importRowId] === "update"
                            ? "default"
                            : "outline"
                        }
                        disabled={busy}
                        onClick={() => setDecision(row.importRowId, "update")}
                      >
                        Update
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={
                          decisions[row.importRowId] === "keep"
                            ? "default"
                            : "outline"
                        }
                        disabled={busy}
                        onClick={() => setDecision(row.importRowId, "keep")}
                      >
                        Keep
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={
                          decisions[row.importRowId] === "delete_existing"
                            ? "destructive"
                            : "outline"
                        }
                        disabled={busy}
                        onClick={() =>
                          setDecision(row.importRowId, "delete_existing")
                        }
                      >
                        Delete &amp; import
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={busy || !allResolved}
            onClick={() => handleCommit().catch(console.error)}
          >
            {busy ? "Applying…" : "Apply decisions"}
          </Button>
          {onCancel ? (
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={onCancel}
            >
              Cancel
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function formatValue(value: unknown): string {
  if (value == null) {
    return "—";
  }
  if (typeof value === "boolean") {
    return value ? "yes" : "no";
  }
  return String(value);
}
