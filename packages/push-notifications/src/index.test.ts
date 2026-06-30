import { describe, expect, it } from "vitest";
import { isPushConfigured } from "./index";

describe("isPushConfigured", () => {
  it("returns true when all VAPID fields are set", () => {
    expect(
      isPushConfigured({
        publicKey: "pub",
        privateKey: "priv",
        subject: "mailto:ops@example.com",
      }),
    ).toBe(true);
  });

  it("returns false when any field is missing", () => {
    expect(isPushConfigured({ publicKey: "pub" })).toBe(false);
  });
});
