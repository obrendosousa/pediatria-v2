/**
 * Cache no navegador para chats e mensagens.
 * Usa MemoryCacheStore in-memory com LRU e auto-GC,
 * com persistência opcional em localStorage para dados críticos.
 */

import { MemoryCacheStore } from './cache/MemoryCacheStore';

const cache = MemoryCacheStore.getInstance();

// Chaves que devem persistir em localStorage entre refreshes
const PERSIST_PREFIXES = ['chats_', 'chat_messages_', 'chats_tags'];

function shouldPersist(key: string): boolean {
  return PERSIST_PREFIXES.some((p) => key.startsWith(p));
}

/**
 * Remove entradas expiradas.
 * No-op — a GC é automática via MemoryCacheStore (a cada 60s).
 */
export function removeExpiredEntries(): void {
  // Handled automatically by MemoryCacheStore GC
}

/**
 * Lê do cache. Retorna null se não existir ou estiver expirado.
 */
export function get<T>(key: string): T | null {
  return cache.get<T>(key);
}

/**
 * Grava no cache com TTL em milissegundos.
 */
export function set<T>(key: string, data: T, ttlMs: number): void {
  cache.set(key, data, ttlMs, shouldPersist(key));
}

/** TTL em ms: lista de chats (5 min). */
export const TTL_CHATS_LIST_MS = 5 * 60 * 1000;

/** TTL em ms: tags (8 min). */
export const TTL_TAGS_MS = 8 * 60 * 1000;

/** TTL em ms: mensagens por chat (5 min). */
export const TTL_MESSAGES_MS = 5 * 60 * 1000;

/** Limite de mensagens por chat no cache para não estourar memória. */
export const MAX_CACHED_MESSAGES_PER_CHAT = 500;

/** Quantidade máxima de entradas de mensagens (chats) a manter no cache. */
export const MAX_CACHED_MESSAGE_ENTRIES = 20;

const MESSAGES_KEY_PREFIX = 'chat_messages_';
const LAST_ACCESS_KEY = 'messages_last_access';

interface LastAccessRecord {
  [key: string]: number;
}

/**
 * Ao salvar mensagens de um chat, registra último acesso e remove entradas
 * além das MAX_CACHED_MESSAGE_ENTRIES mais recentes.
 */
export function touchMessagesCacheKey(chatId: number | string): void {
  const key = `${MESSAGES_KEY_PREFIX}${chatId}`;
  const record = cache.get<LastAccessRecord>(LAST_ACCESS_KEY) || {};
  record[key] = Date.now();

  const entries = Object.entries(record)
    .filter(([k]) => k.startsWith(MESSAGES_KEY_PREFIX))
    .sort((a, b) => b[1] - a[1]);

  if (entries.length > MAX_CACHED_MESSAGE_ENTRIES) {
    const toRemove = entries.slice(MAX_CACHED_MESSAGE_ENTRIES).map(([k]) => k);
    toRemove.forEach((k) => {
      delete record[k];
      cache.delete(k);
    });
  }

  cache.set(LAST_ACCESS_KEY, record, 24 * 60 * 60 * 1000); // 24h TTL
}
