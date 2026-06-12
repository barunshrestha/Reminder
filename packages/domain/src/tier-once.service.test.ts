import { describe, expect, it } from "vitest";
import { getNextTier } from "./tier-once.service";

describe("getNextTier", () => {
  it("returns null when days_behind < 15", () => {
    expect(getNextTier(10, null)).toBeNull();
  });

  it("returns tier 15 at 16 days with no prior send", () => {
    expect(getNextTier(16, null)).toBe(15);
  });

  it("returns tier 15 at 31 days on first evaluation (not tier 30)", () => {
    expect(getNextTier(31, null)).toBe(15);
  });

  it("returns null at 20 days when tier 15 already sent", () => {
    expect(getNextTier(20, 15)).toBeNull();
  });

  it("returns tier 30 at 31 days when tier 15 already sent", () => {
    expect(getNextTier(31, 15)).toBe(30);
  });

  it("returns tier 45 after tier 30 sent and days_behind >= 45", () => {
    expect(getNextTier(50, 30)).toBe(45);
  });
});
