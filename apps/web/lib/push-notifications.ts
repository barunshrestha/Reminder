"use client";

const BASE64_URL = /-/g;
const BASE64_UNDERSCORE = /_/g;

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(BASE64_URL, "+")
    .replace(BASE64_UNDERSCORE, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export async function subscribeToPushNotifications(): Promise<void> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Push notifications are not supported on this browser");
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was denied");
  }

  const { getVapidPublicKey, subscribePush } = await import("@/lib/api");
  const { publicKey } = await getVapidPublicKey();
  if (!publicKey) {
    throw new Error("Push notifications are not configured on the server");
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(
      publicKey,
    ) as BufferSource,
  });

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
    throw new Error("Invalid push subscription");
  }

  await subscribePush({
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  });
}

export async function unsubscribeFromPushNotifications(): Promise<void> {
  const { unsubscribePush } = await import("@/lib/api");
  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await unsubscribePush({ endpoint: subscription.endpoint });
      await subscription.unsubscribe();
    } else {
      await unsubscribePush({});
    }
    return;
  }
  await unsubscribePush({});
}
