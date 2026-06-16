import { describe, expect, it } from "vitest";
import {
  applyMergeFields,
  getDefaultMilestoneTemplate,
  renderReminderEmail,
  templateIdForTier,
} from "./render";

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
    tier: 15,
  };

  it("uses tier template id", () => {
    expect(templateIdForTier(15)).toBe("reminder_tier_15");
    const { templateId } = renderReminderEmail(15, data);
    expect(templateId).toBe("reminder_tier_15");
  });

  it("includes overdue headline and merge fields in default html", () => {
    const { html, subject } = renderReminderEmail(15, data);
    expect(subject).toContain("INV-001");
    expect(subject).toContain("16 days past due");
    expect(html).toContain("Acme Corp");
    expect(html).toContain("16 days past due");
    expect(html).toContain("more than 15 days");
    expect(html).toContain("unsub");
  });

  it("uses custom override when provided", () => {
    const { html, subject } = renderReminderEmail(30, data, {
      subject: "Custom subject for {{invoice_number}}",
      bodyHtml: "Custom body for invoice {{invoice_number}} at tier {{tier}}.",
    });
    expect(subject).toBe("Custom subject for INV-001");
    expect(html).toContain("Custom body for invoice INV-001 at tier 30.");
  });

  it("applyMergeFields replaces all known tokens", () => {
    const result = applyMergeFields(
      "{{client_name}} {{invoice_number}} {{tier}} {{days_behind}}",
      { ...data, vendorName: "Vendor Co" },
    );
    expect(result).toBe("Acme Corp INV-001 15 16");
  });

  it("default milestone template includes tier placeholder", () => {
    const defaults = getDefaultMilestoneTemplate(45);
    expect(defaults.bodyHtml).toContain("{{tier}}");
    expect(defaults.subject).toContain("{{days_behind}}");
  });
});
