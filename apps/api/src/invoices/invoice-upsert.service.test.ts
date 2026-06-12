import { describe, expect, it } from "vitest";
import { computeContentHash } from "@payment-reminder/domain";

describe("invoice upsert content hash", () => {
  it("skips write when hash unchanged", () => {
    const input = {
      invoiceNumber: "INV-1",
      clientName: "Acme",
      totalAmount: "100.00",
      balanceDue: "50.00",
      dueDate: "2026-01-15",
      status: "open" as const,
      emailOptOut: false,
      consentEmail: true,
      reminderDeliveryMode: "email" as const,
    };
    const a = computeContentHash(input);
    const b = computeContentHash({ ...input });
    expect(a).toBe(b);
  });
});
