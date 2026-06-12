import { describe, expect, it } from "vitest";
import { computeContentHash } from "./content-hash.service";
import type { ContentHashInput } from "./types";

function baseInput(overrides: Partial<ContentHashInput> = {}): ContentHashInput {
  return {
    invoiceNumber: "INV-001",
    clientName: "Acme",
    totalAmount: "100",
    balanceDue: "50",
    dueDate: "2026-03-01",
    status: "open",
    emailOptOut: false,
    consentEmail: true,
    reminderDeliveryMode: "email",
    ...overrides,
  };
}

describe("computeContentHash", () => {
  it("returns stable hash for same input", () => {
    const input = baseInput();
    expect(computeContentHash(input)).toBe(computeContentHash(input));
  });

  it("changes hash when balance_due changes", () => {
    const a = computeContentHash(baseInput({ balanceDue: "50.00" }));
    const b = computeContentHash(baseInput({ balanceDue: "25.00" }));
    expect(a).not.toBe(b);
  });

  it("sorts services by name for stable hash", () => {
    const a = computeContentHash(
      baseInput({ services: [{ name: "B" }, { name: "A" }] }),
    );
    const b = computeContentHash(
      baseInput({ services: [{ name: "A" }, { name: "B" }] }),
    );
    expect(a).toBe(b);
  });

  it("includes reminder_delivery_mode in hash", () => {
    const email = computeContentHash(
      baseInput({ reminderDeliveryMode: "email" }),
    );
    const doc = computeContentHash(
      baseInput({ reminderDeliveryMode: "document_only" }),
    );
    expect(email).not.toBe(doc);
  });
});
