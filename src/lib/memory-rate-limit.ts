/**
 * Lightweight per-process fixed-window limiter for hot, cheap public endpoints (e.g. typeahead),
 * where a database round trip per request would cost more than the work being protected.
 * Per instance, so the effective limit scales with instances; the durable, shared limiter for
 * sensitive actions (sign-in, sign-up, uploads) is src/lib/rate-limit.ts.
 */
const windows = new Map<string, { start: number; count: number }>();
let lastSweep = Date.now();

export function allowRequest(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  if (now - lastSweep > windowMs) {
    for (const [k, w] of windows) if (now - w.start >= windowMs) windows.delete(k);
    lastSweep = now;
  }
  const w = windows.get(key);
  if (!w || now - w.start >= windowMs) {
    windows.set(key, { start: now, count: 1 });
    return true;
  }
  w.count += 1;
  return w.count <= limit;
}
