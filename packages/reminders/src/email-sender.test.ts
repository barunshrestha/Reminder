import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildUnsubscribeUrl,
  ConsoleEmailSender,
  createEmailSenderFromEnv,
  SendGridEmailSender,
} from "./email-sender";

describe("buildUnsubscribeUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses PUBLIC_API_BASE_URL when set", () => {
    vi.stubEnv("PUBLIC_API_BASE_URL", "https://api.example.com/v1");
    expect(buildUnsubscribeUrl("INV-42")).toBe(
      "https://api.example.com/v1/public/unsubscribe?invoice=INV-42",
    );
  });

  it("encodes invoice numbers", () => {
    vi.stubEnv("PUBLIC_API_BASE_URL", "http://localhost:3000/api/v1");
    expect(buildUnsubscribeUrl("INV 100/A")).toBe(
      "http://localhost:3000/api/v1/public/unsubscribe?invoice=INV%20100%2FA",
    );
  });
});

describe("ConsoleEmailSender", () => {
  it("accepts messages with from identity", async () => {
    const sender = new ConsoleEmailSender();
    const result = await sender.send({
      to: "client@example.com",
      subject: "Test",
      html: "<p>x</p>",
      text: "x",
      from: { email: "vendor@example.com", name: "Vendor Co" },
      replyTo: "replies@example.com",
    });
    expect(result.accepted).toBe(true);
  });
});

describe("SendGridEmailSender", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts from and reply_to to SendGrid", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 202,
      headers: { get: () => "sg-msg-1" },
    });
    vi.stubGlobal("fetch", fetchMock);

    const sender = new SendGridEmailSender({
      apiKey: "sg-test",
      defaultFromEmail: "default@example.com",
    });

    await sender.send({
      to: "client@example.com",
      subject: "Due",
      html: "<p>Hi</p>",
      text: "Hi",
      from: { email: "vendor@example.com", name: "Vendor" },
      replyTo: "replies@example.com",
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.from).toEqual({ email: "vendor@example.com", name: "Vendor" });
    expect(body.reply_to).toEqual({ email: "replies@example.com" });
  });

  it("throws when SendGrid rejects the message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 400,
        text: async () => "bad request",
      }),
    );

    const sender = new SendGridEmailSender({
      apiKey: "sg-test",
      defaultFromEmail: "default@example.com",
    });

    await expect(
      sender.send({
        to: "client@example.com",
        subject: "Due",
        html: "<p>Hi</p>",
        text: "Hi",
      }),
    ).rejects.toThrow(/SendGrid rejected message/);
  });
});

describe("createEmailSenderFromEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns ConsoleEmailSender by default", () => {
    const sender = createEmailSenderFromEnv({});
    expect(sender).toBeInstanceOf(ConsoleEmailSender);
  });

  it("requires SENDGRID_API_KEY when provider is sendgrid", () => {
    expect(() =>
      createEmailSenderFromEnv({ EMAIL_PROVIDER: "sendgrid" }),
    ).toThrow(/SENDGRID_API_KEY/);
  });

  it("returns SendGridEmailSender when configured", () => {
    const sender = createEmailSenderFromEnv({
      EMAIL_PROVIDER: "sendgrid",
      SENDGRID_API_KEY: "sg-key",
      EMAIL_DEFAULT_FROM: "from@example.com",
    });
    expect(sender).toBeInstanceOf(SendGridEmailSender);
  });
});
