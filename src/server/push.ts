import webpush from "web-push";

import { env } from "~/env";

// Initialize VAPID once at module load
webpush.setVapidDetails(
  env.VAPID_SUBJECT,
  env.VAPID_PUBLIC_KEY,
  env.VAPID_PRIVATE_KEY,
);

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export async function sendPush(
  subscription: PushSubscriptionData,
  payload: { title: string; body: string; url?: string },
): Promise<{ ok: true } | { ok: false; gone: boolean }> {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return { ok: true };
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    // 404/410 means the subscription is no longer valid — caller should delete it
    if (status === 404 || status === 410) {
      return { ok: false, gone: true };
    }
    throw err;
  }
}
