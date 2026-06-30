import { describe, expect, it, vi } from "vitest";
import { UsageService } from "./usage.service";

describe("UsageService", () => {
  it("returns zero when no counter exists", async () => {
    const prisma = {
      usageCounter: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    } as never;
    const service = new UsageService(prisma);
    await expect(service.getUsage("tenant-1", "invoices")).resolves.toBe(0);
  });

  it("computes current billing period", () => {
    const prisma = { usageCounter: { findUnique: vi.fn() } } as never;
    const service = new UsageService(prisma);
    expect(service.currentPeriod()).toMatch(/^\d{4}-\d{2}$/);
  });
});
