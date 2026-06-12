import { describe, expect, it } from "vitest";
import { renderReminderEmail, templateIdForTier } from "./render";

describe("renderReminderEmail", () => {
  const data = {
    clientName: "Acme Corp",
    invoiceNumber: "INV-001",
    totalAmount: "500.00",
    balanceDue: "250.00",
    dueDate: "2026-01-01",
    daysBehind: 16,
    notificationNumber: 0,
    vendorPhysicalAddress: "123 Main St",
    unsubscribeUrl: "https://example.com/unsub",
  };

  it("uses tier template id", () => {
    expect(templateIdForTier(15)).toBe("reminder_tier_15");
    const { templateId } = renderReminderEmail(15, data);
    expect(templateId).toBe("reminder_tier_15");
  });

  it("includes invoice and unsubscribe in html", () => {
    const { html, subject } = renderReminderEmail(15, data);
    expect(subject).toContain("INV-001");
    expect(html).toContain("Acme Corp");
    expect(html).toContain("unsub");
  });
});
