import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { VendorSettingsService } from "./vendor-settings.service";

describe("VendorSettingsService", () => {
  const baseSettings = {
    id: "default",
    timezone: "America/New_York",
    vendorName: "Tarema LLC",
    vendorPhysicalAddress: "123 Main St",
    digestEmailEnabled: false,
    fromEmail: "taremamllc@gmail.com",
    fromName: "Tarema LLC",
    replyToEmail: null,
    emailVerifiedAt: null,
  };

  function createService(overrides?: {
    settings?: Partial<typeof baseSettings>;
    sendResult?: { accepted: boolean; providerMessageId?: string };
  }) {
    const settings = { ...baseSettings, ...overrides?.settings };
    const prisma = {
      vendorSettings: {
        findFirstOrThrow: vi.fn().mockResolvedValue(settings),
        update: vi.fn().mockResolvedValue({
          ...settings,
          emailVerifiedAt: new Date("2026-06-20T12:00:00.000Z"),
        }),
      },
    };
    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const emailSender = {
      send: vi.fn().mockResolvedValue(
        overrides?.sendResult ?? {
          accepted: true,
          providerMessageId: "test-msg",
        },
      ),
    };
    const service = new VendorSettingsService(
      prisma as never,
      audit as never,
      emailSender,
    );
    return { service, prisma, audit, emailSender };
  }

  it("sendTestEmail uses vendor from identity and marks verified", async () => {
    const { service, prisma, audit, emailSender } = createService();

    const result = await service.sendTestEmail({}, "admin@example.com");

    expect(result.ok).toBe(true);
    expect(result.to).toBe("admin@example.com");
    expect(emailSender.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "admin@example.com",
        from: { email: "taremamllc@gmail.com", name: "Tarema LLC" },
      }),
    );
    expect(prisma.vendorSettings.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "default" },
        data: expect.objectContaining({ emailVerifiedAt: expect.any(Date) }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      "email.test.sent",
      expect.objectContaining({ to: "admin@example.com" }),
    );
  });

  it("sendTestEmail rejects when from email is missing", async () => {
    const { service } = createService({
      settings: { fromEmail: null },
    });

    await expect(
      service.sendTestEmail({}, "admin@example.com"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("sendTestEmail rejects when provider does not accept", async () => {
    const { service } = createService({
      sendResult: { accepted: false },
    });

    await expect(
      service.sendTestEmail({}, "admin@example.com"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
