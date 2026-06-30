import { describe, expect, it } from "vitest";
import {
  extractSubdomainFromHost,
  isValidSubdomain,
  normalizeSubdomain,
} from "./subdomain.util";

describe("subdomain.util", () => {
  it("normalizes subdomains", () => {
    expect(normalizeSubdomain(" Acme Corp ")).toBe("acme-corp");
  });

  it("validates allowed subdomains", () => {
    expect(isValidSubdomain("acme-payments")).toBe(true);
    expect(isValidSubdomain("ab")).toBe(false);
    expect(isValidSubdomain("admin")).toBe(false);
  });

  it("extracts subdomain from host", () => {
    process.env.BASE_DOMAIN = "example.com";
    expect(extractSubdomainFromHost("acme.example.com")).toBe("acme");
    expect(extractSubdomainFromHost("demo.localhost")).toBe("demo");
  });
});
