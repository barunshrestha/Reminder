export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export type PushSubscriptionRecord = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type VapidConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

export function isPushConfigured(config: Partial<VapidConfig>): config is VapidConfig {
  return Boolean(config.publicKey && config.privateKey && config.subject);
}

export function vapidConfigFromEnv(): Partial<VapidConfig> {
  return {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
    subject: process.env.VAPID_SUBJECT,
  };
}

export async function sendWebPush(
  config: VapidConfig,
  subscription: PushSubscriptionRecord,
  payload: PushPayload,
): Promise<void> {
  const webpush = await import("web-push");
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  await webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    },
    JSON.stringify(payload),
  );
}

export async function sendWebPushBatch(
  config: VapidConfig,
  subscriptions: PushSubscriptionRecord[],
  payload: PushPayload,
): Promise<{ sent: number; expiredEndpoints: string[] }> {
  let sent = 0;
  const expiredEndpoints: string[] = [];
  for (const subscription of subscriptions) {
    try {
      await sendWebPush(config, subscription, payload);
      sent += 1;
    } catch (error) {
      const statusCode =
        error && typeof error === "object" && "statusCode" in error
          ? (error as { statusCode?: number }).statusCode
          : undefined;
      if (statusCode === 404 || statusCode === 410) {
        expiredEndpoints.push(subscription.endpoint);
      }
    }
  }
  return { sent, expiredEndpoints };
}
