import { createHash } from "node:crypto";

import { incrementRateLimitCounter } from "~/server/db/users-client";

// A single window/threshold pair, e.g. "5 requests per hour".
export interface RateLimitWindow {
  /** Window length in seconds. */
  windowSeconds: number;
  /** Max requests allowed within the window (inclusive). */
  max: number;
}

export interface RateLimitOptions {
  /** Per-IP windows, e.g. 5/hour and 20/day. */
  perIp: RateLimitWindow[];
  /**
   * Optional global cap shared across all IPs, e.g. 100 signups/day —
   * protects shared Turso/Resend quotas regardless of source IP.
   */
  global?: RateLimitWindow;
}

export interface RateLimitResult {
  limited: boolean;
  /** Which check tripped, for logging/debugging. Undefined when not limited. */
  reason?: string;
}

// Derives the client IP from standard proxy headers. Vercel (and most
// reverse proxies) set x-forwarded-for to "client, proxy1, proxy2, ..." —
// the first entry is the original client.
function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

// We never store raw IPs — only a one-way hash — so a leaked rate-limit
// table doesn't expose user IP addresses.
function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

// Fixed-window counter: bucket = floor(now / windowSeconds). Simple and
// cheap; slightly bursty at window boundaries but fine for abuse protection.
async function checkWindow(
  ipHash: string,
  scope: string,
  window: RateLimitWindow,
): Promise<boolean> {
  const windowStart =
    Math.floor(Date.now() / 1000 / window.windowSeconds) * window.windowSeconds;
  const count = await incrementRateLimitCounter(ipHash, scope, windowStart);
  return count > window.max;
}

/**
 * Checks (and records) a request against per-IP and optional global rate
 * limits for the given scope (e.g. "signup", "resend").
 *
 * Fails OPEN on any error — a rate-limiter outage must never take down
 * signup — but logs so the failure is visible.
 */
export async function checkRateLimit(
  req: Request,
  scope: string,
  limits: RateLimitOptions,
): Promise<RateLimitResult> {
  try {
    const ip = getClientIp(req);
    const ipHash = hashIp(ip);

    for (const window of limits.perIp) {
      const limited = await checkWindow(ipHash, scope, window);
      if (limited) {
        return { limited: true, reason: `per-ip:${window.windowSeconds}s` };
      }
    }

    if (limits.global) {
      const limited = await checkWindow("__global__", `${scope}:global`, limits.global);
      if (limited) {
        return { limited: true, reason: "global" };
      }
    }

    return { limited: false };
  } catch (err) {
    console.error(`[rate-limit] check failed for scope "${scope}", failing open`, err);
    return { limited: false };
  }
}
