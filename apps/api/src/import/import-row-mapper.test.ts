import { describe, expect, it } from "vitest";
import { mapSpreadsheetRow } from "./import-row-mapper";

const columnMap = {
  "Client Name": "client_name",
  "Invoice #": "invoice_number",
  Total: "total_amount",
  Balance: "balance_due",
  "Due Date": "due_date",
  Email: "client_email",
};

describe("mapSpreadsheetRow", () => {
  it("maps a valid email-mode row", () => {
    const { row, errors } = mapSpreadsheetRow(
      {
        "Client Name": "Acme",
        "Invoice #": "INV-1",
        Total: "100.00",
        Balance: "50.00",
        "Due Date": "2026-01-15",
        Email: "a@b.com",
      },
      columnMap,
      2,
    );
    expect(errors).toHaveLength(0);
    expect(row?.invoiceNumber).toBe("INV-1");
    expect(row?.reminderDeliveryMode).toBe("email");
  });

  it("parses currency-formatted amounts from Excel", () => {
    const { row, errors } = mapSpreadsheetRow(
      {
        "Client Name": "Acme",
        "Invoice #": "INV-99",
        Total: "$5,250.00",
        Balance: "$1,200.50",
        "Due Date": "2026-01-15",
        Email: "a@b.com",
      },
      columnMap,
      5,
    );
    expect(errors).toHaveLength(0);
    expect(row?.totalAmount).toBe("5250.00");
    expect(row?.balanceDue).toBe("1200.50");
  });

  it("uses document_only when client_email is missing", () => {
    const { row, errors } = mapSpreadsheetRow(
      {
        "Client Name": "Acme",
        "Invoice #": "INV-2",
        Total: "100",
        Balance: "50",
        "Due Date": "2026-01-15",
      },
      columnMap,
      3,
    );
    expect(errors).toHaveLength(0);
    expect(row?.reminderDeliveryMode).toBe("document_only");
  });

  it("allows document_only without email", () => {
    const map = { ...columnMap, Mode: "reminder_delivery_mode" };
    const { row, errors } = mapSpreadsheetRow(
      {
        "Client Name": "Acme",
        "Invoice #": "INV-3",
        Total: "100",
        Balance: "50",
        "Due Date": "2026-01-15",
        Mode: "document_only",
      },
      map,
      4,
    );
    expect(errors).toHaveLength(0);
    expect(row?.reminderDeliveryMode).toBe("document_only");
    expect(row?.clientEmail).toBeUndefined();
  });
});
