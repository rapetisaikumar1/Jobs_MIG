import "server-only";

/**
 * Small in-process cache for public, viewer-independent data (published jobs). Caches the
 * promise, so concurrent misses share one database query instead of stampeding it. Entries
 * expire after `ttlMs`; writers call invalidateCache(prefix) so changes show immediately on
 * this instance (other instances catch up within the TTL).
 */
// One store per server process. Kept on globalThis because server actions and pages can be
// bundled separately, each with its own copy of this module; a module-level Map would let an
// action's invalidateCache() clear a different store than the pages read from.
type Entry = { at: number; value: Promise<unknown> };
const globalStore = globalThis as typeof globalThis & { __migTtlCache?: Map<string, Entry> };
const store = (globalStore.__migTtlCache ??= new Map<string, Entry>());
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
