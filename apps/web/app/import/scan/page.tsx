"use client";

import { useCallback, useEffect, useState } from "react";
import { ScanDropZone } from "@/components/import/scan-drop-zone";
import { ScanReviewCard } from "@/components/import/scan-review-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  confirmInvoiceScan,
  extractInvoiceScanBatch,
  listInvoiceScanUploads,
  type ConfirmScanInvoiceInput,
  type ConfirmScanResult,
  type InvoiceScanUploadItem,
  type ScanExtractionPreview,
} from "@/lib/api";

function isScanPreview(
  result: ScanExtractionPreview | { filename: string; ok: false; error: string },
): result is ScanExtractionPreview {
  return "scanId" in result;
}

export default function ImportScanPage() {
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [previews, setPreviews] = useState<ScanExtractionPreview[]>([]);
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<string[]>([]);
  const [history, setHistory] = useState<InvoiceScanUploadItem[]>([]);

  const refreshHistory = useCallback(async () => {
    const items = await listInvoiceScanUploads();
    setHistory(items);
  }, []);

  useEffect(() => {
    refreshHistory().catch(console.error);
  }, [refreshHistory]);

  async function onFilesSelected(files: File[]) {
    setBusy(true);
    setStatusMessage("Extracting invoice data from images…");
    setErrors([]);
    try {
      const { results } = await extractInvoiceScanBatch(files);
      const extracted: ScanExtractionPreview[] = [];
      const failed: string[] = [];
      for (const result of results) {
        if (isScanPreview(result)) {
          extracted.push(result);
        } else {
          failed.push(`${result.filename}: ${result.error}`);
        }
      }
      setPreviews((current) => [...current, ...extracted]);
      setErrors(failed);
      setStatusMessage(
        extracted.length > 0
          ? `Ready to review ${extracted.length} invoice(s).`
          : "No invoices could be extracted.",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Extraction failed";
      setStatusMessage(message);
    } finally {
      setBusy(false);
    }
  }

  async function onConfirmOne(input: ConfirmScanInvoiceInput): Promise<ConfirmScanResult> {
    setBusy(true);
    try {
      const result = await confirmInvoiceScan(input);
      if (result.outcome !== "conflict") {
        setConfirmedIds((ids) => new Set(ids).add(result.scanId));
        setStatusMessage(
          `Invoice ${result.invoiceNumber} ${result.outcome === "inserted" ? "created" : result.outcome}.`,
        );
        await refreshHistory();
      }
      return result;
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Scan or upload invoice</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ScanDropZone disabled={busy} onFiles={onFilesSelected} />
          {statusMessage ? (
            <p className="text-sm text-muted-foreground">{statusMessage}</p>
          ) : null}
          {errors.length > 0 ? (
            <Alert variant="destructive">
              <AlertTitle>Extraction errors</AlertTitle>
              <AlertDescription>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      {previews.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-lg font-medium">Review extracted invoices</h2>
          {previews.map((preview) => (
            <ScanReviewCard
              key={preview.scanId}
              preview={preview}
              busy={busy}
              confirmed={confirmedIds.has(preview.scanId)}
              onConfirm={onConfirmOne}
            />
          ))}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Scan history</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scans yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {history.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
                >
                  <span>{item.originalFilename}</span>
                  <span className="text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
