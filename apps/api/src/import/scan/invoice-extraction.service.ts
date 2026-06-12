import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { ExtractedInvoiceFields } from "./invoice-scan.types";

const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    invoice_number: { type: ["string", "null"] },
    client_name: { type: ["string", "null"] },
    total_amount: { type: ["string", "null"] },
    balance_due: { type: ["string", "null"] },
    services: {
      type: ["array", "null"],
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          amount: { type: ["string", "null"] },
        },
        required: ["name"],
      },
    },
    invoice_date: { type: ["string", "null"] },
    due_date: { type: ["string", "null"] },
    client_email: { type: ["string", "null"] },
    confidence: {
      type: "object",
      additionalProperties: { type: "number" },
    },
  },
  required: ["confidence"],
};

@Injectable()
export class InvoiceExtractionService {
  async extractFromImage(
    buffer: Buffer,
    mimeType: string,
  ): Promise<ExtractedInvoiceFields> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        "OPENAI_API_KEY is not configured for invoice scan extraction",
      );
    }

    const model = process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4o-mini";
    const base64 = buffer.toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "invoice_extraction",
            strict: true,
            schema: EXTRACTION_SCHEMA,
          },
        },
        messages: [
          {
            role: "system",
            content:
              "You extract structured invoice fields from images of invoices or receipts. " +
              "Return numeric amounts as plain decimal strings without currency symbols (e.g. 1250.00). " +
              "Dates must be ISO YYYY-MM-DD when possible. " +
              "For services, list each line item or service description. " +
              "Set confidence scores from 0 to 1 per field key using snake_case names.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract invoice_number, client_name, total_amount, balance_due, services, invoice_date, due_date, and client_email from this document.",
              },
              {
                type: "image_url",
                image_url: { url: dataUrl },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new BadRequestException(
        `Invoice extraction failed: ${detail.slice(0, 300)}`,
      );
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new BadRequestException("Invoice extraction returned empty content");
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content) as Record<string, unknown>;
    } catch {
      throw new BadRequestException("Invoice extraction returned invalid JSON");
    }

    return this.normalizeExtraction(parsed);
  }

  private normalizeExtraction(
    parsed: Record<string, unknown>,
  ): ExtractedInvoiceFields {
    const confidence =
      typeof parsed.confidence === "object" && parsed.confidence !== null
        ? (parsed.confidence as Record<string, number>)
        : {};

    let services: ExtractedInvoiceFields["services"];
    if (Array.isArray(parsed.services)) {
      services = [];
      for (const item of parsed.services) {
        if (typeof item !== "object" || item === null) {
          continue;
        }
        const record = item as Record<string, unknown>;
        const name = String(record.name ?? "").trim();
        if (!name) {
          continue;
        }
        const entry: { name: string; amount?: string } = { name };
        if (record.amount != null) {
          entry.amount = String(record.amount).trim();
        }
        services.push(entry);
      }
      if (services.length === 0) {
        services = undefined;
      }
    }

    return {
      invoiceNumber: stringOrUndefined(parsed.invoice_number),
      clientName: stringOrUndefined(parsed.client_name),
      totalAmount: stringOrUndefined(parsed.total_amount),
      balanceDue: stringOrUndefined(parsed.balance_due),
      services,
      invoiceDate: stringOrUndefined(parsed.invoice_date),
      dueDate: stringOrUndefined(parsed.due_date),
      clientEmail: stringOrUndefined(parsed.client_email),
      confidence,
    };
  }
}

function stringOrUndefined(value: unknown): string | undefined {
  if (value == null) {
    return undefined;
  }
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
