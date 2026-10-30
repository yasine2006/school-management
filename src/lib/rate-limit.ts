import "server-only";
import { headers } from "next/headers";

const WINDOW_MS = 15 * 60 * 1000;

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export async function clientIp() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return h.get("x-real-ip")?.trim() || "unknown";
}

export function consumeAttempt(key: string, maxAttempts: number) {
  const now = Date.now();
  if (buckets.size > 5000) {
    for (const [k, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(k);
    }
  }

  const current = buckets.get(key);
  const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + WINDOW_MS } : current;
  bucket.count += 1;
  buckets.set(key, bucket);

  return {
    blocked: bucket.count > maxAttempts,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

export function resetAttempts(keys: string[]) {
  for (const key of keys) buckets.delete(key);
}
