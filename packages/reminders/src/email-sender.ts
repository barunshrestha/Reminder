export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
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
    console.log(
      `[email] to=${input.to} subject=${input.subject} bytes=${input.html.length}`,
    );
    return { accepted: true, providerMessageId: `console-${Date.now()}` };
  }
}
