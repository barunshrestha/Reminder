export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: { email: string; name?: string };
  replyTo?: string;
  headers?: Record<string, string>;
}

export interface SendEmailResult {
  accepted: boolean;
  providerMessageId?: string;
}

export interface EmailSender {
  send(input: SendEmailInput): Promise<SendEmailResult>;
}

/** Development sender: logs and reports success. */
export class ConsoleEmailSender implements EmailSender {
  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const from = input.from?.email ?? "default";
    console.log(
      `[email] from=${from} to=${input.to} subject=${input.subject} bytes=${input.html.length}`,
    );
    return { accepted: true, providerMessageId: `console-${Date.now()}` };
  }
}

export interface SendGridEmailSenderOptions {
  apiKey: string;
  defaultFromEmail: string;
  defaultFromName?: string;
}

/** Platform-managed SendGrid sender. */
export class SendGridEmailSender implements EmailSender {
  constructor(private readonly options: SendGridEmailSenderOptions) {}

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const fromEmail = input.from?.email ?? this.options.defaultFromEmail;
    const fromName = input.from?.name ?? this.options.defaultFromName;
    const from = fromName
      ? { email: fromEmail, name: fromName }
      : { email: fromEmail };

    const body = {
      personalizations: [{ to: [{ email: input.to }] }],
      from,
      reply_to: input.replyTo ? { email: input.replyTo } : undefined,
      subject: input.subject,
      content: [
        { type: "text/plain", value: input.text },
        { type: "text/html", value: input.html },
      ],
      headers: input.headers,
    };

    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (response.status >= 200 && response.status < 300) {
      const messageId = response.headers.get("x-message-id") ?? undefined;
      return { accepted: true, providerMessageId: messageId };
    }

    const errorText = await response.text().catch(() => "");
    throw new Error(
      `SendGrid rejected message (${response.status}): ${errorText.slice(0, 200)}`,
    );
  }
}

export function createEmailSenderFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): EmailSender {
  const provider = (env.EMAIL_PROVIDER ?? "console").toLowerCase();
  if (provider === "sendgrid") {
    const apiKey = env.SENDGRID_API_KEY;
    if (!apiKey) {
      throw new Error("SENDGRID_API_KEY is required when EMAIL_PROVIDER=sendgrid");
    }
    return new SendGridEmailSender({
      apiKey,
      defaultFromEmail:
        env.EMAIL_DEFAULT_FROM ?? "taremamllc@gmail.com",
      defaultFromName: env.EMAIL_DEFAULT_FROM_NAME,
    });
  }
  return new ConsoleEmailSender();
}

export function publicApiBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return (
    env.PUBLIC_API_BASE_URL ??
    `${env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1"}`
  ).replace(/\/$/, "");
}

export function buildUnsubscribeUrl(
  invoiceNumber: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const base = publicApiBaseUrl(env);
  return `${base}/public/unsubscribe?invoice=${encodeURIComponent(invoiceNumber)}`;
}
