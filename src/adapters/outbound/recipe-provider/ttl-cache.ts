interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Minimal in-memory TTL cache. Not a port/domain concept — this is an
 * infrastructure detail of outbound adapters that need to avoid redundant
 * upstream calls (e.g. rate-limited third-party APIs).
 */
export class TtlCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();

  constructor(private readonly maxEntries: number = Number.POSITIVE_INFINITY) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    this.store.delete(key);
    if (this.store.size >= this.maxEntries) {
      this.prune();
      while (this.store.size >= this.maxEntries) {
        const oldest = this.store.keys().next();
        if (oldest.done) break;
        this.store.delete(oldest.value);
      }
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt <= now) this.store.delete(key);
    }
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}
