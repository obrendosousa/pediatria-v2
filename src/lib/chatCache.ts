/**
 * Cache no navegador para chats e mensagens.
 * Usa localStorage com TTL (time-to-live); entradas expiradas são removidas na leitura/escrita.
 */

const PREFIX = 'chat_cache_';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

function fullKey(key: string): string {
  return `${PREFIX}${key}`;
}

function getAllCacheKeys(): string[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k && k.startsWith(PREFIX)) keys.push(k);
  }
  return keys;
}

/**
 * Remove entradas do cache que já expiraram (para não encher o localStorage).
 */
export function removeExpiredEntries(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const now = Date.now();
  const keys = getAllCacheKeys();
  keys.forEach((key) => {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw) as CacheEntry<unknown>;
      if (parsed.expiresAt && now > parsed.expiresAt) {
        window.localStorage.removeItem(key);
      }
    } catch {
      window.localStorage.removeItem(key);
    }
  });
}

/**
 * Lê do cache. Retorna null se não existir ou estiver expirado.
 * Remove a chave se estiver expirada.
 */
export function get<T>(key: string): T | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  const k = fullKey(key);
  try {
    const raw = window.localStorage.getItem(k);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() > entry.expiresAt) {
      window.localStorage.removeItem(k);
      return null;
    }
    return entry.data;
  } catch {
    window.localStorage.removeItem(k);
    return null;
  }
}

/**
 * Grava no cache com TTL em milissegundos.
 * Chama removeExpiredEntries para limpar entradas antigas.
 */
export function set<T>(key: string, data: T, ttlMs: number): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const k = fullKey(key);
  const expiresAt = Date.now() + ttlMs;
  try {
    window.localStorage.setItem(k, JSON.stringify({ data, expiresAt } as CacheEntry<T>));
    removeExpiredEntries();
  } catch (e) {
    console.warn('[chatCache] set failed:', e);
  }
}

/** TTL em ms: lista de chats (5 min). */
export const TTL_CHATS_LIST_MS = 5 * 60 * 1000;

/** TTL em ms: tags (8 min). */
export const TTL_TAGS_MS = 8 * 60 * 1000;

/** TTL em ms: mensagens por chat (5 min). */
export const TTL_MESSAGES_MS = 5 * 60 * 1000;

/** Limite de mensagens por chat no cache para não estourar localStorage. */
export const MAX_CACHED_MESSAGES_PER_CHAT = 500;

/** Quantidade máxima de entradas de mensagens (chats) a manter no cache; as mais antigas por último acesso são removidas. */
export const MAX_CACHED_MESSAGE_ENTRIES = 20;

const MESSAGES_KEY_PREFIX = 'chat_messages_';
const LAST_ACCESS_KEY = 'chat_cache_messages_last_access';

interface LastAccessRecord {
  [key: string]: number;
}

/**
 * Ao salvar mensagens de um chat, registra último acesso e remove entradas de mensagens
 * além das MAX_CACHED_MESSAGE_ENTRIES mais recentes.
 */
export function touchMessagesCacheKey(chatId: number | string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const key = `${MESSAGES_KEY_PREFIX}${chatId}`;
  try {
    const raw = window.localStorage.getItem(fullKey(LAST_ACCESS_KEY));
    const record: LastAccessRecord = raw ? (JSON.parse(raw) as LastAccessRecord) : {};
    record[key] = Date.now();
    const entries = Object.entries(record)
      .filter(([k]) => k.startsWith(MESSAGES_KEY_PREFIX))
      .sort((a, b) => b[1] - a[1]);
    if (entries.length > MAX_CACHED_MESSAGE_ENTRIES) {
      const toRemove = entries.slice(MAX_CACHED_MESSAGE_ENTRIES).map(([k]) => k);
      toRemove.forEach((k) => {
        delete record[k];
        window.localStorage.removeItem(fullKey(k));
      });
    }
    window.localStorage.setItem(fullKey(LAST_ACCESS_KEY), JSON.stringify(record));
  } catch {
    // ignore
  }
}
