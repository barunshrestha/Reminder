import type { PrismaClient } from "@prisma/client";
import {
  isPushConfigured,
  sendWebPushBatch,
  vapidConfigFromEnv,
} from "@payment-reminder/push-notifications";

export async function dispatchReminderRunFailureAlert(
  prisma: PrismaClient,
  scheduleId: string,
  message: string,
): Promise<void> {
  const config = vapidConfigFromEnv();
  if (!isPushConfigured(config)) {
    return;
  }

  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    select: { name: true },
  });

  const users = await prisma.user.findMany({
    where: {
      notificationPreference: {
        pushEnabled: true,
        reminderRunFailures: true,
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
    return;
  }

  const result = await sendWebPushBatch(config, subscriptions, {
    title: "Reminder run failed",
    body: schedule?.name ? `${schedule.name}: ${message}` : message,
    url: "/schedules",
    tag: "reminder-run-failure",
  });

  if (result.expiredEndpoints.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: { endpoint: { in: result.expiredEndpoints } },
    });
  }
}
