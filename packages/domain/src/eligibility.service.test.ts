import { describe, expect, it } from "vitest";
import { evaluateEligibility } from "./eligibility.service";
import type { EligibilityInput } from "./types";

function baseInvoice(overrides: Partial<EligibilityInput> = {}): EligibilityInput {
  return {
    clientName: "Acme Corp",
    invoiceNumber: "INV-001",
    totalAmount: "1000.00",
    balanceDue: "500.00",
    dueDate: "2026-01-01",
    clientEmail: "client@example.com",
    sendReminder: true,
    status: "open",
    emailOptOut: false,
    consentEmail: true,
    reminderDeliveryMode: "email",
    lastTierSent: null,
    isActive: true,
    daysBehind: 16,
    ...overrides,
  };
}

describe("evaluateEligibility", () => {
  it("is eligible for tier 15 at 16 days overdue", () => {
    const result = evaluateEligibility(baseInvoice());
    expect(result.eligible).toBe(true);
    expect(result.nextTier).toBe(15);
  });

  it("excludes when send_reminder is false", () => {
    const result = evaluateEligibility(baseInvoice({ sendReminder: false }));
    expect(result.eligible).toBe(false);
    expect(result.failures.some((f) => f.rule === "ELIG-01")).toBe(true);
  });

  it("excludes paid invoices", () => {
    const result = evaluateEligibility(
      baseInvoice({ status: "paid", balanceDue: "0.00" }),
    );
    expect(result.eligible).toBe(false);
    expect(result.failures.some((f) => f.rule === "ELIG-03")).toBe(true);
  });

  it("excludes when email_opt_out is true", () => {
    const result = evaluateEligibility(baseInvoice({ emailOptOut: true }));
    expect(result.eligible).toBe(false);
    expect(result.failures.some((f) => f.rule === "ELIG-05")).toBe(true);
  });

  it("excludes when consent_email is false in email mode", () => {
    const result = evaluateEligibility(baseInvoice({ consentEmail: false }));
    expect(result.eligible).toBe(false);
    expect(result.failures.some((f) => f.rule === "ELIG-07")).toBe(true);
  });

  it("allows document_only without client_email", () => {
    const result = evaluateEligibility(
      baseInvoice({
        reminderDeliveryMode: "document_only",
        clientEmail: null,
        daysBehind: 31,
      }),
    );
    expect(result.eligible).toBe(true);
    expect(result.nextTier).toBe(15);
  });

  it("first evaluation at 31 days yields tier 15 only", () => {
    const result = evaluateEligibility(baseInvoice({ daysBehind: 31 }));
    expect(result.nextTier).toBe(15);
  });
});
