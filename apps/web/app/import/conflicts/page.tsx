"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ImportConflictReview } from "@/components/import/import-conflict-review";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  commitImportBatch,
  getImportBatch,
  listPendingImportBatches,
  type ImportBatchDetail,
  type PendingImportBatch,
} from "@/lib/api";

export default function ImportConflictsPage() {
  const [batches, setBatches] = useState<PendingImportBatch[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ImportBatchDetail | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const list = await listPendingImportBatches();
    setBatches(list);
    if (selectedId && !list.some((b) => b.id === selectedId)) {
      setSelectedId(null);
      setDetail(null);
    }
  }, [selectedId]);

  useEffect(() => {
    refresh().catch(console.error);
  }, [refresh]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    getImportBatch(selectedId)
      .then(setDetail)
      .catch(console.error);
  }, [selectedId]);

  const conflictRows = useMemo(() => {
    if (!detail) {
      return [];
    }
    return detail.rows
      .filter((row) => row.status === "conflict")
      .map((row) => ({
        importRowId: row.id,
        rowNumber: row.rowNumber,
        invoiceNumber: row.invoiceNumber,
        status: row.status,
        existing: row.existingSnapshot ?? undefined,
        incoming: row.mappedPayload,
        changedFields: row.changedFields,
      }));
  }, [detail]);

  async function onCommit(
    decisions: Array<{
      importRowId: string;
      resolution: "update" | "keep" | "delete_existing";
    }>,
  ) {
    if (!detail) {
      return;
    }
    setBusy(true);
    try {
      await commitImportBatch(detail.id, decisions);
      await refresh();
      if (selectedId) {
        const updated = await getImportBatch(selectedId);
        setDetail(updated);
      }
    } finally {
      setBusy(false);
    }
  }

  function batchLabel(batch: PendingImportBatch): string {
    if (batch.spreadsheetUpload?.originalFilename) {
      return `Spreadsheet: ${batch.spreadsheetUpload.originalFilename}`;
    }
    if (batch.scanUpload?.originalFilename) {
      return `Scan: ${batch.scanUpload.originalFilename}`;
    }
    if (batch.connector?.name) {
      return `Connector: ${batch.connector.name}`;
    }
    return `${batch.source} batch`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Review and resolve invoice data conflicts from spreadsheet, scan,
          connector, or integration imports.
        </p>
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href="/import">Back to spreadsheet import</Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Open batches</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {batches.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No pending conflicts.
              </p>
            ) : (
              batches.map((batch) => (
                <button
                  key={batch.id}
                  type="button"
                  className={`w-full rounded-md border px-3 py-2 text-left text-sm transition hover:bg-muted/50 ${
                    selectedId === batch.id ? "border-primary bg-muted/30" : ""
                  }`}
                  onClick={() => setSelectedId(batch.id)}
                >
                  <div className="font-medium">{batchLabel(batch)}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(batch.createdAt).toLocaleString()} ·{" "}
                    {batch.source}
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          {detail && conflictRows.length > 0 ? (
            <ImportConflictReview
              batchId={detail.id}
              rows={conflictRows}
              busy={busy}
              onCommit={onCommit}
            />
          ) : detail ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No unresolved conflicts in this batch.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Select a batch to review conflicts.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
