import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class StripeBillingService {
  private readonly logger = new Logger(StripeBillingService.name);

  constructor(private readonly prisma: PrismaService) {}

  isConfigured(): boolean {
    return Boolean(process.env.STRIPE_SECRET_KEY);
  }

  async handleWebhook(rawBody: Buffer, signature: string | undefined) {
    if (!this.isConfigured()) {
      this.logger.warn("Stripe webhook received but STRIPE_SECRET_KEY not set");
      return { received: false };
    }

    const eventId = signature ?? `dev-${Date.now()}`;
    const existing = await this.prisma.stripeWebhookEvent.findUnique({
      where: { stripeEventId: eventId },
    });
    if (existing?.processedAt) {
      return { received: true, duplicate: true };
    }

    let payload: object;
    try {
      payload = JSON.parse(rawBody.toString("utf8")) as object;
    } catch {
      payload = { raw: rawBody.toString("utf8").slice(0, 500) };
    }

    const event = await this.prisma.stripeWebhookEvent.upsert({
      where: { stripeEventId: eventId },
      create: {
        stripeEventId: eventId,
        type: (payload as { type?: string }).type ?? "unknown",
        payload,
      },
      update: {},
    });

    await this.processEvent(event.type, payload);

    await this.prisma.stripeWebhookEvent.update({
      where: { id: event.id },
      data: { processedAt: new Date() },
    });

    return { received: true };
  }

  private async processEvent(type: string, payload: object) {
    if (type === "customer.subscription.updated" || type === "customer.subscription.deleted") {
      const data = payload as {
        data?: { object?: { id?: string; status?: string } };
      };
      const subId = data.data?.object?.id;
      const status = data.data?.object?.status;
      if (subId && status) {
        const mapped =
          status === "active"
            ? "active"
            : status === "trialing"
              ? "trialing"
              : status === "past_due"
                ? "past_due"
                : status === "canceled"
                  ? "canceled"
                  : "unpaid";
        await this.prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subId },
          data: { status: mapped },
        });
      }
    }
  }
}
