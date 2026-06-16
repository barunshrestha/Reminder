import { describe, expect, it } from "vitest";
import {
  buildCronFromPreset,
  describeProcessingSchedule,
  inferProcessingFromSchedule,
  inferTierPreset,
  normalizeTiers,
  resolveOverdueTiers,
  validateOverdueTiers,
} from "./processing-schedule";

describe("processing-schedule", () => {
  it("builds daily cron", () => {
    expect(
      buildCronFromPreset({ preset: "daily", runHour: 8 }),
    ).toBe("0 8 * * *");
  });

  it("builds weekly cron", () => {
    expect(
      buildCronFromPreset({ preset: "weekly", runHour: 9, weeklyDay: 1 }),
    ).toBe("0 9 * * 1");
  });

  it("infers daily from cron", () => {
    expect(
      inferProcessingFromSchedule({
        enabled: true,
        cronExpression: "0 8 * * *",
      }),
    ).toEqual({ processingPreset: "daily", runHour: 8, weeklyDay: 1 });
  });

  it("infers manual when disabled", () => {
    expect(
      inferProcessingFromSchedule({
        enabled: false,
        cronExpression: "0 8 * * *",
      }).processingPreset,
    ).toBe("manual");
  });

  it("describes daily schedule", () => {
    expect(
      describeProcessingSchedule({
        processingPreset: "daily",
        runHour: 8,
        timezone: "America/New_York",
        remindersEnabled: true,
      }),
    ).toContain("Every day at 8:00 AM");
  });

  it("resolves tier presets", () => {
    expect(resolveOverdueTiers("standard")).toEqual([15, 30, 45, 60]);
    expect(inferTierPreset([15, 30, 45, 60])).toBe("standard");
    expect(normalizeTiers([60, 15, 30, 45])).toEqual([15, 30, 45, 60]);
  });

  it("validates tiers", () => {
    expect(validateOverdueTiers([15, 30]).valid).toBe(true);
    expect(validateOverdueTiers([]).valid).toBe(false);
    expect(validateOverdueTiers([0]).valid).toBe(false);
  });
});
