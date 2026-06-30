import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";
import { RolesGuard } from "./roles.guard";

function mockContext(tenantRole?: "admin" | "operator"): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({
        tenantContext: tenantRole ? { tenantRole } : undefined,
      }),
    }),
  } as ExecutionContext;
}

describe("RolesGuard", () => {
  it("allows admin for admin-only routes", () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(["admin"]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(mockContext("admin"))).toBe(true);
  });

  it("denies operator for admin-only routes", () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(["admin"]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(mockContext("operator"))).toThrow(
      ForbiddenException,
    );
  });
});
