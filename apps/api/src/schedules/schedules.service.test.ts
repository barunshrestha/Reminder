import { describe, expect, it } from "vitest";
import { validateScheduleExpression } from "@payment-reminder/domain";

describe("schedule expression validation (API)", () => {
  it("rejects both cron and rrule", () => {
    expect(
      validateScheduleExpression({
        cronExpression: "0 9 * * 1",
        rrule: "FREQ=WEEKLY",
      }),
    ).toMatchObject({ valid: false });
  });

  it("accepts weekly cron", () => {
    expect(
      validateScheduleExpression({ cronExpression: "0 9 * * 1" }),
    ).toEqual({ valid: true });
  });
});
