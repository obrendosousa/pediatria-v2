import { EventEmitter } from 'events';
import type { TVCallPayload } from '@/types/queue';

// Persiste entre hot-reloads do Next.js
declare global {
  // eslint-disable-next-line no-var
  var __tvEmitter: EventEmitter | undefined;
}

export const tvEmitter: EventEmitter =
  global.__tvEmitter ?? (global.__tvEmitter = new EventEmitter());

export function emitTvCall(payload: TVCallPayload) {
  tvEmitter.emit('call', JSON.stringify(payload));
}
