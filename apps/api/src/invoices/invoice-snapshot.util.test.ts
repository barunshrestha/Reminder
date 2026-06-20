import { describe, expect, it } from "vitest";
import {
  diffSnapshots,
  snapshotFromInput,
} from "./invoice-snapshot.util";
import type { UpsertInvoiceInput } from "./invoice-upsert.service";

describe("invoice-snapshot", () => {
  const baseInput = (): UpsertInvoiceInput => ({
    clientName: "Acme",
    invoiceNumber: "INV-1",
    totalAmount: "100.00",
    balanceDue: "50.00",
    dueDate: "2026-01-15",
  });

  it("detects changed fields between snapshots", () => {
    const existing = snapshotFromInput(baseInput());
    const incoming = snapshotFromInput({
      ...baseInput(),
      balanceDue: "25.00",
      clientName: "Beta Corp",
    });
    const changed = diffSnapshots(existing, incoming);
    expect(changed).toContain("balance_due");
    expect(changed).toContain("client_name");
    expect(changed).not.toContain("invoice_number");
  });
});
