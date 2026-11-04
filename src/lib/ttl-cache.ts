import "server-only";

/**
 * Small in-process cache for public, viewer-independent data (published jobs). Caches the
 * promise, so concurrent misses share one database query instead of stampeding it. Entries
 * expire after `ttlMs`; writers call invalidateCache(prefix) so changes show immediately on
 * this instance (other instances catch up within the TTL).
 */
const store = new Map<string, { at: number; value: Promise<unknown> }>();
const MAX_ENTRIES = 1000;

export function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && now - hit.at < ttlMs) return hit.value as Promise<T>;
  const value = load().catch((error) => {
    store.delete(key); // never cache failures
    throw error;
  });
  if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value!);
  store.set(key, { at: now, value });
  return value;
}

export function invalidateCache(prefix: string) {
  for (const key of store.keys()) if (key.startsWith(prefix)) store.delete(key);
}
