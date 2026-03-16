/**
 * MemoryCacheStore — Singleton in-memory cache com TTL, LRU eviction,
 * auto-GC e stale-while-revalidate.
 *
 * Substitui o cache baseado em localStorage por um Map em memoria,
 * com fallback opcional para localStorage (persistencia entre refreshes).
 */

interface CacheEntry<T = unknown> {
  data: T;
  expiresAt: number;
  createdAt: number;
  lastAccessedAt: number;
  sizeBytes: number;
  persist: boolean;
  revalidating: boolean;
}

interface StoreOptions {
  maxEntries: number;
  maxMemoryBytes: number;
  gcIntervalMs: number;
}

const DEFAULT_OPTIONS: StoreOptions = {
  maxEntries: 200,
  maxMemoryBytes: 50 * 1024 * 1024, // 50 MB
  gcIntervalMs: 60_000, // 60s
};

const STORAGE_PREFIX = 'mcache_';

function estimateSize(data: unknown): number {
  try {
    return JSON.stringify(data).length * 2; // rough UTF-16
  } catch {
    return 1024; // fallback 1KB
  }
}

class MemoryCacheStore {
  private static instance: MemoryCacheStore | null = null;

  private store = new Map<string, CacheEntry>();
  private accessOrder: string[] = [];
  private gcTimer: ReturnType<typeof setInterval> | null = null;
  private opts: StoreOptions;
  private totalBytes = 0;
  private hits = 0;
  private misses = 0;

  private constructor(opts: Partial<StoreOptions> = {}) {
    this.opts = { ...DEFAULT_OPTIONS, ...opts };
    this.startGC();
    this.hydrateFromStorage();
  }

  static getInstance(opts?: Partial<StoreOptions>): MemoryCacheStore {
    if (!MemoryCacheStore.instance) {
      MemoryCacheStore.instance = new MemoryCacheStore(opts);
    }
    return MemoryCacheStore.instance;
  }

  // ─── Public API ────────────────────────────────────────

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      this.misses++;
      return null;
    }
    entry.lastAccessedAt = Date.now();
    this.touchAccess(key);
    this.hits++;
    return entry.data as T;
  }

  /**
   * Retorna dado mesmo expirado (stale), junto com flags de estado.
   */
  getStale<T>(key: string): { data: T | null; isStale: boolean; isFresh: boolean } {
    const entry = this.store.get(key);
    if (!entry) {
      return { data: null, isStale: false, isFresh: false };
    }
    const now = Date.now();
    const expired = now > entry.expiresAt;
    entry.lastAccessedAt = now;
    this.touchAccess(key);
    return {
      data: entry.data as T,
      isStale: expired,
      isFresh: !expired,
    };
  }

  /**
   * Stale-While-Revalidate: retorna dado imediatamente (mesmo expirado)
   * e dispara revalidacao em background.
   */
  async getOrFetch<T>(key: string, fetcher: () => Promise<T>, ttlMs: number, persist = false): Promise<T> {
    const entry = this.store.get(key);
    const now = Date.now();

    if (entry) {
      entry.lastAccessedAt = now;
      this.touchAccess(key);

      if (now <= entry.expiresAt) {
        this.hits++;
        return entry.data as T;
      }

      // Stale — revalidar em background se nao estiver ja revalidando
      if (!entry.revalidating) {
        entry.revalidating = true;
        fetcher()
          .then((freshData) => {
            this.set(key, freshData, ttlMs, persist);
          })
          .catch(() => {
            entry.revalidating = false;
          });
      }

      this.hits++;
      return entry.data as T;
    }

    // Nao tem dado — fetch sincrono
    this.misses++;
    const data = await fetcher();
    this.set(key, data, ttlMs, persist);
    return data;
  }

  set<T>(key: string, data: T, ttlMs: number, persist = false): void {
    const existing = this.store.get(key);
    if (existing) {
      this.totalBytes -= existing.sizeBytes;
    }

    const sizeBytes = estimateSize(data);
    const now = Date.now();

    const entry: CacheEntry<T> = {
      data,
      expiresAt: now + ttlMs,
      createdAt: now,
      lastAccessedAt: now,
      sizeBytes,
      persist,
      revalidating: false,
    };

    this.store.set(key, entry as CacheEntry);
    this.totalBytes += sizeBytes;
    this.touchAccess(key);

    // Evictar se necessario
    while (this.store.size > this.opts.maxEntries || this.totalBytes > this.opts.maxMemoryBytes) {
      if (!this.evictLRU()) break;
    }

    // Persistir em localStorage se marcado
    if (persist) {
      this.persistEntry(key, entry as CacheEntry);
    }
  }

  delete(key: string): void {
    const entry = this.store.get(key);
    if (entry) {
      this.totalBytes -= entry.sizeBytes;
      this.store.delete(key);
      this.accessOrder = this.accessOrder.filter((k) => k !== key);
      if (entry.persist) {
        this.removePersistedEntry(key);
      }
    }
  }

  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      return false;
    }
    return true;
  }

  clear(): void {
    this.store.clear();
    this.accessOrder = [];
    this.totalBytes = 0;
    this.clearPersistedEntries();
  }

  getStats() {
    const total = this.hits + this.misses;
    return {
      entries: this.store.size,
      memoryUsedBytes: this.totalBytes,
      memoryUsedMB: Math.round(this.totalBytes / 1024 / 1024 * 100) / 100,
      hitRate: total > 0 ? Math.round((this.hits / total) * 100) : 0,
      hits: this.hits,
      misses: this.misses,
    };
  }

  // ─── LRU ───────────────────────────────────────────────

  private touchAccess(key: string): void {
    const idx = this.accessOrder.indexOf(key);
    if (idx !== -1) {
      this.accessOrder.splice(idx, 1);
    }
    this.accessOrder.push(key);
  }

  private evictLRU(): boolean {
    if (this.accessOrder.length === 0) return false;
    const oldestKey = this.accessOrder[0];
    this.delete(oldestKey);
    return true;
  }

  // ─── Garbage Collection ────────────────────────────────

  private startGC(): void {
    if (typeof window === 'undefined') return;
    this.gcTimer = setInterval(() => this.collectExpired(), this.opts.gcIntervalMs);
  }

  private collectExpired(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    this.store.forEach((entry, key) => {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((key) => this.delete(key));
  }

  // ─── Persistencia localStorage ─────────────────────────

  private persistEntry(key: string, entry: CacheEntry): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const payload = {
        data: entry.data,
        expiresAt: entry.expiresAt,
      };
      window.localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(payload));
    } catch {
      // localStorage full ou quota exceeded — ignora
    }
  }

  private removePersistedEntry(key: string): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
  }

  private clearPersistedEntries(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(STORAGE_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
  }

  private hydrateFromStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const now = Date.now();
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(STORAGE_PREFIX)) keys.push(k);
    }
    keys.forEach((storageKey) => {
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) return;
        const parsed = JSON.parse(raw) as { data: unknown; expiresAt: number };
        if (now > parsed.expiresAt) {
          window.localStorage.removeItem(storageKey);
          return;
        }
        const cacheKey = storageKey.slice(STORAGE_PREFIX.length);
        const sizeBytes = estimateSize(parsed.data);
        this.store.set(cacheKey, {
          data: parsed.data,
          expiresAt: parsed.expiresAt,
          createdAt: now,
          lastAccessedAt: now,
          sizeBytes,
          persist: true,
          revalidating: false,
        });
        this.totalBytes += sizeBytes;
        this.accessOrder.push(cacheKey);
      } catch {
        window.localStorage.removeItem(storageKey);
      }
    });
  }

  destroy(): void {
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = null;
    }
  }
}

export { MemoryCacheStore };
export type { StoreOptions };
