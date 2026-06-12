import { describe, expect, it } from "vitest";
import {
  addDaysToIsoDate,
  resolveDueDate,
  validateConfirmScanInput,
} from "./invoice-scan.mapper";

describe("invoice-scan.mapper", () => {
  it("uses extracted due date when present", () => {
    expect(
      resolveDueDate(
        { dueDate: "2026-03-15", invoiceDate: "2026-02-01" },
        30,
      ),
    ).toBe("2026-03-15");
  });

  it("defaults due date to invoice date + payment terms", () => {
    expect(
      resolveDueDate({ invoiceDate: "2026-02-01" }, 30),
    ).toBe("2026-03-03");
  });

  it("returns null when no dates are available", () => {
    expect(resolveDueDate({}, 30)).toBeNull();
  });

  it("adds days across month boundaries", () => {
    expect(addDaysToIsoDate("2026-01-15", 30)).toBe("2026-02-14");
  });

  it("validates confirm payload", () => {
    const errors = validateConfirmScanInput({
      scanId: "scan-1",
      invoiceNumber: "",
      clientName: "Acme",
      totalAmount: "100",
      balanceDue: "50",
      dueDate: "2026-01-15",
    });
    expect(errors.some((e) => e.field === "invoiceNumber")).toBe(true);
  });
});
