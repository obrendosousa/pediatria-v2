/**
 * Cache em memória para áudios do chat.
 * Evita re-fetch do mesmo áudio e acelera carregamento.
 */

const MAX_ENTRIES = 30;
const TTL_MS = 60 * 60 * 1000; // 1 hora

interface CacheEntry {
  blobUrl: string;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const lruKeys: string[] = [];

function evictIfNeeded(): void {
  if (lruKeys.length <= MAX_ENTRIES) return;
  const toRemove = lruKeys.splice(0, lruKeys.length - MAX_ENTRIES);
  toRemove.forEach((key) => {
    const entry = cache.get(key);
    if (entry) {
      try {
        URL.revokeObjectURL(entry.blobUrl);
      } catch {
        // ignore
      }
      cache.delete(key);
    }
  });
}

function touchKey(key: string): void {
  const idx = lruKeys.indexOf(key);
  if (idx >= 0) lruKeys.splice(idx, 1);
  lruKeys.push(key);
}

export function getCachedBlobUrl(url: string): string | null {
  const entry = cache.get(url);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > TTL_MS) {
    try {
      URL.revokeObjectURL(entry.blobUrl);
    } catch {
      // ignore
    }
    cache.delete(url);
    const i = lruKeys.indexOf(url);
    if (i >= 0) lruKeys.splice(i, 1);
    return null;
  }
  touchKey(url);
  return entry.blobUrl;
}

export function setCachedBlobUrl(url: string, blobUrl: string): void {
  evictIfNeeded();
  const existing = cache.get(url);
  if (existing) {
    try {
      URL.revokeObjectURL(existing.blobUrl);
    } catch {
      // ignore
    }
  }
  touchKey(url);
  cache.set(url, { blobUrl, timestamp: Date.now() });
}
