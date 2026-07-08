import webpush from "web-push";

import { env } from "~/env";

// Initialized lazily: module-scope setup would run while Next.js collects
// page data at build time (e.g. in CI), where the VAPID env vars don't exist.
let vapidInitialized = false;

function ensureVapid() {
  if (vapidInitialized) return;
  webpush.setVapidDetails(
    env.VAPID_SUBJECT,
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY,
  );
  vapidInitialized = true;
}

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
  ensureVapid();
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
