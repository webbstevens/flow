/**
 * Simple in-memory sliding window rate limiter.
 * Resets when the process restarts (fine for MVP on a single Railway container).
 */

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 10;

interface Entry {
  timestamps: number[];
}

const store = new Map<string, Entry>();

// Clean stale entries every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
    if (entry.timestamps.length === 0) store.delete(key);
  }
}, 5 * 60_000).unref();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

export function checkRateLimit(keyPrefix: string): RateLimitResult {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;

  let entry = store.get(keyPrefix);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(keyPrefix, entry);
  }

  // Drop timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  if (entry.timestamps.length >= MAX_REQUESTS) {
    const oldestInWindow = entry.timestamps[0];
    return {
      allowed: false,
      remaining: 0,
      resetMs: oldestInWindow + WINDOW_MS - now,
    };
  }

  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: MAX_REQUESTS - entry.timestamps.length,
    resetMs: WINDOW_MS,
  };
}
