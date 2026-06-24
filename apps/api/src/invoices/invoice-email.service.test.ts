import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { InvoiceEmailService } from "./invoice-email.service";

describe("InvoiceEmailService", () => {
  const baseInvoice = {
    id: "inv-1",
    invoiceNumber: "INV-100",
    clientName: "Acme Corp",
    clientEmail: "client@acme.com",
    clientPhone: null,
    totalAmount: { toString: () => "1000.00" },
    balanceDue: { toString: () => "500.00", lte: () => false },
    dueDate: new Date("2026-01-01T00:00:00.000Z"),
    dateOfService: null,
    services: null,
    status: "open" as const,
    emailOptOut: false,
    lastTierSent: null,
    notificationNumber: 0,
    comments: null,
  };

  const vendor = {
    id: "default",
    timezone: "America/New_York",
    overdueTiers: [15, 30, 45, 60],
    includeCommentsInEmail: false,
    vendorName: "Tarema LLC",
    vendorPhysicalAddress: "123 Main St",
    fromEmail: "vendor@example.com",
    fromName: "Tarema LLC",
    replyToEmail: null,
  };

  function createService(overrides?: {
    invoice?: Partial<typeof baseInvoice> | null;
    sendResult?: { accepted: boolean; providerMessageId?: string };
  }) {
    const invoice =
      overrides?.invoice === null
        ? null
        : { ...baseInvoice, ...overrides?.invoice };

    const prisma = {
      invoice: {
        findUnique: vi.fn().mockResolvedValue(invoice),
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValue({ ...baseInvoice, notificationNumber: 1 }),
        update: vi.fn(),
      },
      vendorSettings: {
        findFirstOrThrow: vi.fn().mockResolvedValue(vendor),
      },
      reminderMilestoneTemplate: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      tierNotification: { create: vi.fn() },
      $transaction: vi.fn(async (fn: (tx: typeof prisma) => Promise<void>) => {
        await fn(prisma);
      }),
    };

    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const emailSender = {
      send: vi.fn().mockResolvedValue(
        overrides?.sendResult ?? {
          accepted: true,
          providerMessageId: "msg-1",
        },
      ),
    };

    const service = new InvoiceEmailService(
      prisma as never,
      audit as never,
      emailSender,
    );

    return { service, prisma, audit, emailSender };
  }

  it("sends email using vendor from identity", async () => {
    const { service, emailSender, audit } = createService();

    const result = await service.sendToClient("INV-100", "user-1");

    expect(result.ok).toBe(true);
    expect(result.to).toBe("client@acme.com");
    expect(emailSender.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "client@acme.com",
        from: { email: "vendor@example.com", name: "Tarema LLC" },
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      "email.sent",
      expect.objectContaining({ source: "manual", invoice_number: "INV-100" }),
    );
  });

  it("rejects when client email is missing", async () => {
    const { service } = createService({
      invoice: { clientEmail: null },
    });

    await expect(service.sendToClient("INV-100")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("rejects when vendor from email is not configured", async () => {
    const prisma = {
      invoice: {
        findUnique: vi.fn().mockResolvedValue(baseInvoice),
      },
      vendorSettings: {
        findFirstOrThrow: vi.fn().mockResolvedValue({
          ...vendor,
          fromEmail: null,
        }),
      },
    };
    const service = new InvoiceEmailService(
      prisma as never,
      { record: vi.fn() } as never,
      { send: vi.fn() },
    );
    const prev = process.env.EMAIL_DEFAULT_FROM;
    delete process.env.EMAIL_DEFAULT_FROM;

    try {
      await expect(service.sendToClient("INV-100")).rejects.toBeInstanceOf(
        BadRequestException,
      );
    } finally {
      if (prev !== undefined) {
        process.env.EMAIL_DEFAULT_FROM = prev;
      }
    }
  });
});
