import { describe, expect, it } from "vitest";
import { computeDaysBehind } from "./days-behind";

describe("computeDaysBehind", () => {
  const tz = "America/New_York";

  it("returns 0 when due date is today in vendor TZ", () => {
    const asOf = new Date("2026-06-04T18:00:00Z");
    expect(computeDaysBehind("2026-06-04", asOf, tz)).toBe(0);
  });

  it("returns calendar days overdue", () => {
    const asOf = new Date("2026-06-19T12:00:00Z");
    expect(computeDaysBehind("2026-06-04", asOf, tz)).toBe(15);
  });

  it("floors at 0 for future due dates", () => {
    const asOf = new Date("2026-06-01T12:00:00Z");
    expect(computeDaysBehind("2026-06-10", asOf, tz)).toBe(0);
  });
});
