/**
 * Creates a Map-based TTL cache.
 * @param {number} ttlMs - Time-to-live in milliseconds
 * @returns Cache object with get/set/has/invalidate/clear methods
 */
export function createCache(ttlMs) {
  const store = new Map(); // key → { data, expiresAt }

  return {
    get(key) {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return undefined;
      }
      return entry.data;
    },
    set(key, data) {
      store.set(key, { data, expiresAt: Date.now() + ttlMs });
    },
    has(key) {
      const entry = store.get(key);
      if (!entry) return false;
      if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return false;
      }
      return true;
    },
    invalidate(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
    get size() {
      return store.size;
    },
  };
}
