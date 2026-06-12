import { describe, expect, it } from "vitest";
import { assertReadOnlySql } from "./connector-sql";

describe("assertReadOnlySql", () => {
  it("allows SELECT", () => {
    expect(() =>
      assertReadOnlySql("SELECT client_name, invoice_number FROM invoices"),
    ).not.toThrow();
  });

  it("rejects INSERT", () => {
    expect(() => assertReadOnlySql("INSERT INTO x VALUES (1)")).toThrow();
  });
});
