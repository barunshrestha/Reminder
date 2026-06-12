import { describe, expect, it, vi } from "vitest";
import { evaluateEligibility } from "@payment-reminder/domain";

describe("reminder run eligibility integration", () => {
  it("first evaluation at 31 days sends tier 15 only", () => {
    const result = evaluateEligibility(
      {
        clientName: "A",
        invoiceNumber: "INV-1",
        totalAmount: "100",
        balanceDue: "50",
        dueDate: "2026-01-01",
        sendReminder: true,
        status: "open",
        emailOptOut: false,
        consentEmail: true,
        reminderDeliveryMode: "email",
        lastTierSent: null,
        isActive: true,
        clientEmail: "a@example.com",
        daysBehind: 31,
      },
      [15, 30, 45, 60],
    );
    expect(result.eligible).toBe(true);
    expect(result.nextTier).toBe(15);
  });
});

describe("ConsoleEmailSender", () => {
  it("accepts messages", async () => {
    const { ConsoleEmailSender } = await import("./email-sender");
    const sender = new ConsoleEmailSender();
    const result = await sender.send({
      to: "a@b.com",
      subject: "Test",
      html: "<p>x</p>",
      text: "x",
    });
    expect(result.accepted).toBe(true);
  });
});
