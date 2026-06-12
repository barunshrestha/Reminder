import { describe, expect, it } from "vitest";
import {
  isScheduleDue,
  validateScheduleExpression,
} from "./schedule-expression";

describe("validateScheduleExpression", () => {
  it("requires exactly one of cron or rrule", () => {
    expect(validateScheduleExpression({})).toEqual({
      valid: false,
      message: "Provide exactly one of cron_expression or rrule",
    });
    expect(
      validateScheduleExpression({
        cronExpression: "0 9 * * 1",
        rrule: "FREQ=WEEKLY",
      }),
    ).toEqual({
      valid: false,
      message: "Provide exactly one of cron_expression or rrule",
    });
  });

  it("accepts valid cron", () => {
    expect(
      validateScheduleExpression({ cronExpression: "0 9 * * 1" }),
    ).toEqual({ valid: true });
  });

  it("accepts valid rrule", () => {
    expect(
      validateScheduleExpression({
        rrule: "FREQ=WEEKLY;BYDAY=MO;BYHOUR=9;BYMINUTE=0",
      }),
    ).toEqual({ valid: true });
  });
});

describe("isScheduleDue", () => {
  it("detects cron due in window", () => {
    const due = isScheduleDue(
      { cronExpression: "* * * * *", timezone: "UTC" },
      new Date("2026-06-04T12:01:00Z"),
      new Date("2026-06-04T12:00:00Z"),
    );
    expect(due).toBe(true);
  });
});
