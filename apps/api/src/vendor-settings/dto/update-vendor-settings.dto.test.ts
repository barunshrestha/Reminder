import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { describe, expect, it } from "vitest";
import { UpdateVendorSettingsDto } from "./update-vendor-settings.dto";

describe("UpdateVendorSettingsDto", () => {
  it("accepts valid email delivery fields", async () => {
    const dto = plainToInstance(UpdateVendorSettingsDto, {
      from_email: "vendor@example.com",
      from_name: "Vendor LLC",
      reply_to_email: "replies@example.com",
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it("rejects invalid from_email", async () => {
    const dto = plainToInstance(UpdateVendorSettingsDto, {
      from_email: "not-an-email",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "from_email")).toBe(true);
  });

  it("rejects invalid reply_to_email", async () => {
    const dto = plainToInstance(UpdateVendorSettingsDto, {
      reply_to_email: "bad",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "reply_to_email")).toBe(true);
  });
});
