/**
 * Tiny in-memory TTL cache.
 *
 * Even though the user picked "fetch on every request", a tiny in-process
 * cache (5 min) prevents hammering tspk.org / Google Sheets when a single
 * user rapidly switches between tabs / days. Cache is per-process and is
 * cleared on every serverless cold start — effectively "by request" from
 * the user's perspective.
 */

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, Entry<unknown>>();

export async function cached<T>(
  key: string,
  ttlMs: number,
  producer: () => Promise<T>,
): Promise<T> {
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value;
  }
  const value = await producer();
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

/** Invalidate a single key. */
export function invalidate(key: string): void {
  store.delete(key);
}

/** Test helper — clear everything. */
export function clearCache(): void {
  store.clear();
}
