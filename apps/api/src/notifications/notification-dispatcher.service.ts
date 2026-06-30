import {
  Injectable,
  Logger,
} from "@nestjs/common";
import {
  isPushConfigured,
  sendWebPushBatch,
  vapidConfigFromEnv,
  type PushPayload,
} from "@payment-reminder/push-notifications";
import { PrismaService } from "../prisma/prisma.service";

export type AlertKind = "import_failure" | "reminder_run_failure";

@Injectable()
export class NotificationDispatcherService {
  private readonly logger = new Logger(NotificationDispatcherService.name);

  constructor(private readonly prisma: PrismaService) {}

  getPublicVapidKey(): string | null {
    const config = vapidConfigFromEnv();
    return config.publicKey ?? null;
  }

  async upsertSubscription(
    userId: string,
    input: {
      endpoint: string;
      keys: { p256dh: string; auth: string };
      userAgent?: string;
    },
  ) {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: {
        userId,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: input.userAgent,
      },
      update: {
        userId,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: input.userAgent,
      },
    });
    await this.prisma.userNotificationPreference.upsert({
      where: { userId },
      create: { userId, pushEnabled: true },
      update: { pushEnabled: true },
    });
  }

  async removeSubscription(userId: string, endpoint?: string) {
    if (endpoint) {
      await this.prisma.pushSubscription.deleteMany({
        where: { userId, endpoint },
      });
    } else {
      await this.prisma.pushSubscription.deleteMany({ where: { userId } });
    }
    await this.prisma.userNotificationPreference.upsert({
      where: { userId },
      create: { userId, pushEnabled: false },
      update: { pushEnabled: false },
    });
  }

  async getPreferences(userId: string) {
    const pref = await this.prisma.userNotificationPreference.findUnique({
      where: { userId },
    });
    return {
      pushEnabled: pref?.pushEnabled ?? false,
      importFailures: pref?.importFailures ?? true,
      reminderRunFailures: pref?.reminderRunFailures ?? true,
      pushConfigured: Boolean(this.getPublicVapidKey()),
      subscriptionCount: await this.prisma.pushSubscription.count({
        where: { userId },
      }),
    };
  }

  async updatePreferences(
    userId: string,
    input: Partial<{
      pushEnabled: boolean;
      importFailures: boolean;
      reminderRunFailures: boolean;
    }>,
  ) {
    return this.prisma.userNotificationPreference.upsert({
      where: { userId },
      create: {
        userId,
        pushEnabled: input.pushEnabled ?? false,
        importFailures: input.importFailures ?? true,
        reminderRunFailures: input.reminderRunFailures ?? true,
      },
      update: input,
    });
  }

  async dispatchAlert(kind: AlertKind, payload: PushPayload) {
    const config = vapidConfigFromEnv();
    if (!isPushConfigured(config)) {
      return { sent: 0, skipped: "vapid_not_configured" as const };
    }

    const preferenceField =
      kind === "import_failure" ? "importFailures" : "reminderRunFailures";

    const users = await this.prisma.user.findMany({
      where: {
        notificationPreference: {
          pushEnabled: true,
          [preferenceField]: true,
        },
      },
      select: {
        pushSubscriptions: {
          select: { endpoint: true, p256dh: true, auth: true },
        },
      },
    });

    const subscriptions = users.flatMap((user) => user.pushSubscriptions);
    if (subscriptions.length === 0) {
      return { sent: 0, skipped: "no_subscriptions" as const };
    }

    const result = await sendWebPushBatch(config, subscriptions, payload);
    if (result.expiredEndpoints.length > 0) {
      await this.prisma.pushSubscription.deleteMany({
        where: { endpoint: { in: result.expiredEndpoints } },
      });
    }
    this.logger.log(
      `Push ${kind}: sent=${result.sent}, expired=${result.expiredEndpoints.length}`,
    );
    return { sent: result.sent };
  }
}
