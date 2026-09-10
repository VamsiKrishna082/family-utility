type Entry<T> = { value: T; expires: number };

/**
 * A small in-process cache. Cloud Run keeps an instance warm between requests, so this
 * turns repeat folder listings into memory reads instead of Drive round trips.
 * Nothing here is correctness-critical: a cold instance just refetches.
 */
export class TTLCache<T> {
  private map = new Map<string, Entry<T>>();

  constructor(
    private ttlMs: number,
    private max = 500,
  ) {}

  get(key: string): T | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expires < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    // Refresh recency for the LRU eviction below.
    this.map.delete(key);
    this.map.set(key, hit);
    return hit.value;
  }

  set(key: string, value: T) {
    if (this.map.size >= this.max) {
      const oldest = this.map.keys().next().value;
      if (oldest) this.map.delete(oldest);
    }
    this.map.set(key, { value, expires: Date.now() + this.ttlMs });
  }

  drop(key: string) {
    this.map.delete(key);
  }

  clear() {
    this.map.clear();
  }
}
