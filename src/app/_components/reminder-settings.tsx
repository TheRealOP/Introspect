"use client";

import { useEffect, useState } from "react";

import { api } from "~/trpc/react";

// Convert a base64url string to Uint8Array (required by PushManager.subscribe)
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = atob(base64);
  const bytes = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    bytes[i] = rawData.charCodeAt(i);
  }
  return bytes;
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    ("standalone" in window.navigator &&
      (window.navigator as { standalone?: boolean }).standalone === true) ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

function supportsWebPush(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export function ReminderSettings() {
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, refetch } = api.reminders.get.useQuery();
  const updateReminders = api.reminders.update.useMutation();
  const subscribePush = api.push.subscribe.useMutation();
  const unsubscribePush = api.push.unsubscribe.useMutation();

  const enabled = data?.enabled ?? false;
  const intervalHours = data?.intervalHours ?? 3;

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // iOS but not installed as PWA — show install prompt
  if (isIos() && !isStandalone()) {
    return (
      <div className="rounded-xl border border-glass-border bg-glass-bg p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-lg">🔔</span>
          <h3 className="font-semibold text-white">Check-in Reminders</h3>
        </div>
        <p className="mb-3 text-sm text-white/60">
          On iPhone, reminders require Introspect to be installed as an app.
        </p>
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="text-sm font-medium text-amber-300">
            Install Introspect first:
          </p>
          <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-amber-200/80">
            <li>
              Tap the <strong>Share</strong> button{" "}
              <span className="text-base">⎙</span> in Safari
            </li>
            <li>
              Choose <strong>Add to Home Screen</strong>
            </li>
            <li>Open the app from your home screen, then come back here</li>
          </ol>
        </div>
      </div>
    );
  }

  // Browser doesn't support Web Push at all
  if (!supportsWebPush()) {
    return (
      <div className="rounded-xl border border-glass-border bg-glass-bg p-5">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-lg">🔔</span>
          <h3 className="font-semibold text-white">Check-in Reminders</h3>
        </div>
        <p className="text-sm text-white/50">
          Your browser doesn&apos;t support push notifications. Try Chrome,
          Edge, Firefox, or Safari 16.4+ on iOS.
        </p>
      </div>
    );
  }

  async function handleToggle() {
    setError(null);
    setSaving(true);
    try {
      if (!enabled) {
        // Request permission
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setError("Notification permission denied. Enable it in browser settings.");
          return;
        }

        // Register service worker
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;

        // Subscribe to push
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });

        const json = sub.toJSON() as {
          endpoint: string;
          keys: { p256dh: string; auth: string };
        };

        await subscribePush.mutateAsync({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
          userAgent: navigator.userAgent,
        });
        await updateReminders.mutateAsync({ enabled: true, intervalHours });
      } else {
        // Unsubscribe from push
        const reg = await navigator.serviceWorker.getRegistration("/sw.js");
        if (reg) {
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            await unsubscribePush.mutateAsync({ endpoint: sub.endpoint });
            await sub.unsubscribe();
          }
        }
        await updateReminders.mutateAsync({ enabled: false, intervalHours });
      }

      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function handleIntervalChange(hours: number) {
    setSaving(true);
    setError(null);
    try {
      await updateReminders.mutateAsync({ enabled, intervalHours: hours });
      await refetch();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-glass-border bg-glass-bg p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔔</span>
          <div>
            <h3 className="font-semibold text-white">Check-in Reminders</h3>
            <p className="text-xs text-white/40">
              Get notified when it&apos;s time to check in
            </p>
          </div>
        </div>

        {/* Toggle */}
        <button
          onClick={handleToggle}
          disabled={saving}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary-hover focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-50 ${
            enabled ? "bg-brand-primary" : "bg-white/20"
          }`}
          aria-label={enabled ? "Disable reminders" : "Enable reminders"}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {/* Interval selector — only shown when enabled */}
      {enabled && (
        <div className="mt-4 flex items-center gap-3">
          <span className="text-sm text-white/60">Remind me every</span>
          <select
            value={intervalHours}
            onChange={(e) => handleIntervalChange(Number(e.target.value))}
            disabled={saving}
            className="rounded-lg border border-glass-border bg-glass-bg px-3 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-primary-hover disabled:opacity-50"
          >
            {[1, 2, 3, 4, 6, 8, 12, 24].map((h) => (
              <option key={h} value={h} className="bg-[#15162c] text-white">
                {h} {h === 1 ? "hour" : "hours"}
              </option>
            ))}
          </select>
          <span className="text-sm text-white/60">of inactivity</span>
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-400">{error}</p>
      )}

      {saving && (
        <p className="mt-3 text-sm text-white/40">Saving…</p>
      )}
    </div>
  );
}
