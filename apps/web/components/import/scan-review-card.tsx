"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  type ConfirmScanInvoiceInput,
  fetchScanImageBlob,
  type ScanExtractionPreview,
} from "@/lib/api";

type ScanReviewCardProps = {
  preview: ScanExtractionPreview;
  busy?: boolean;
  confirmed?: boolean;
  onConfirm: (input: ConfirmScanInvoiceInput) => Promise<void>;
};

function confidenceBadge(score?: number) {
  if (score == null) {
    return null;
  }
  if (score >= 0.85) {
    return <Badge variant="secondary">High confidence</Badge>;
  }
  if (score >= 0.6) {
    return <Badge variant="outline">Review suggested</Badge>;
  }
  return <Badge variant="destructive">Low confidence</Badge>;
}

function fieldConfidence(
  confidence: Record<string, number>,
  key: string,
): number | undefined {
  return confidence[key] ?? confidence[key.replace(/([A-Z])/g, "_$1").toLowerCase()];
}

export function ScanReviewCard({
  preview,
  busy,
  confirmed,
  onConfirm,
}: ScanReviewCardProps) {
  const { extracted, suggestedDueDate, paymentTermsDays } = preview;
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState(
    extracted.invoiceNumber ?? "",
  );
  const [clientName, setClientName] = useState(extracted.clientName ?? "");
  const [totalAmount, setTotalAmount] = useState(extracted.totalAmount ?? "");
  const [balanceDue, setBalanceDue] = useState(extracted.balanceDue ?? "");
  const [dueDate, setDueDate] = useState(
    suggestedDueDate ?? extracted.dueDate ?? "",
  );
  const [clientEmail, setClientEmail] = useState(extracted.clientEmail ?? "");
  const [servicesText, setServicesText] = useState(
    extracted.services?.map((s) => s.name).join("\n") ?? "",
  );
  const [dateOfService, setDateOfService] = useState(
    extracted.invoiceDate ?? "",
  );

  useEffect(() => {
    let objectUrl: string | null = null;
    fetchScanImageBlob(preview.scanId)
      .then((url) => {
        objectUrl = url;
        setImageSrc(url);
      })
      .catch(console.error);
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [preview.scanId]);

  async function handleConfirm() {
    const services = servicesText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((name) => ({ name }));

    await onConfirm({
      scanId: preview.scanId,
      invoiceNumber,
      clientName,
      totalAmount,
      balanceDue,
      dueDate,
      clientEmail: clientEmail || undefined,
      dateOfService: dateOfService || undefined,
      services: services.length > 0 ? services : undefined,
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-base">{preview.filename}</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Due date defaults to invoice date + {paymentTermsDays} days when not
            found on the document.
          </p>
        </div>
        {confirmed ? <Badge>Imported</Badge> : null}
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-md border bg-muted/30">
          {imageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageSrc}
              alt={`Scanned invoice ${preview.filename}`}
              className="max-h-[28rem] w-full object-contain"
            />
          ) : (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              Loading image…
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Field
            label="Invoice number"
            value={invoiceNumber}
            onChange={setInvoiceNumber}
            confidence={fieldConfidence(extracted.confidence, "invoice_number")}
            disabled={confirmed}
          />
          <Field
            label="Client name"
            value={clientName}
            onChange={setClientName}
            confidence={fieldConfidence(extracted.confidence, "client_name")}
            disabled={confirmed}
          />
          <Field
            label="Invoice total"
            value={totalAmount}
            onChange={setTotalAmount}
            confidence={fieldConfidence(extracted.confidence, "total_amount")}
            disabled={confirmed}
          />
          <Field
            label="Balance due"
            value={balanceDue}
            onChange={setBalanceDue}
            confidence={fieldConfidence(extracted.confidence, "balance_due")}
            disabled={confirmed}
          />
          <Field
            label="Due date"
            value={dueDate}
            onChange={setDueDate}
            type="date"
            confidence={fieldConfidence(extracted.confidence, "due_date")}
            disabled={confirmed}
          />
          <Field
            label="Date of service / invoice date"
            value={dateOfService}
            onChange={setDateOfService}
            type="date"
            confidence={fieldConfidence(extracted.confidence, "invoice_date")}
            disabled={confirmed}
          />
          <Field
            label="Client email (optional)"
            value={clientEmail}
            onChange={setClientEmail}
            type="email"
            confidence={fieldConfidence(extracted.confidence, "client_email")}
            disabled={confirmed}
          />
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor={`services-${preview.scanId}`}>
                Services provided
              </Label>
              {confidenceBadge(
                fieldConfidence(extracted.confidence, "services"),
              )}
            </div>
            <Textarea
              id={`services-${preview.scanId}`}
              value={servicesText}
              onChange={(e) => setServicesText(e.target.value)}
              placeholder="One service per line"
              rows={4}
              disabled={confirmed}
            />
          </div>

          {!confirmed ? (
            <Button
              type="button"
              disabled={busy}
              onClick={() => handleConfirm().catch(console.error)}
            >
              {busy ? "Importing…" : "Confirm import"}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  confidence,
  type = "text",
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  confidence?: number;
  type?: string;
  disabled?: boolean;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor={id}>{label}</Label>
        {confidenceBadge(confidence)}
      </div>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}
