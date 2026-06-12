import { describe, expect, it } from "vitest";
import { sendVendorDigest } from "./vendor-digest";
import { ConsoleEmailSender } from "./email-sender";

describe("sendVendorDigest", () => {
  it("sends to all recipients", async () => {
    const sender = new ConsoleEmailSender();
    const result = await sendVendorDigest(sender, {
      runId: "run-1",
      scheduleName: "Weekly",
      stats: {
        evaluated: 10,
        eligible: 2,
        emailsSent: 1,
        documentsGenerated: 0,
        skippedAlreadySent: 0,
        skippedIneligible: 8,
        failed: 0,
        dryRun: false,
      },
      recipients: ["admin@example.com"],
    });
    expect(result.sent).toBe(1);
  });
});
