/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * useRealtimeSubscription — Hook centralizado para subscriptions Supabase resilientes.
 *
 * Resolve:
 * 1. Monitoramento de status (SUBSCRIBED, CHANNEL_ERROR, TIMED_OUT)
 * 2. Reconexão automática com backoff exponencial
 * 3. Detecção de visibilitychange (tab em background)
 * 4. Detecção de online/offline (rede instável)
 * 5. Polling fallback quando realtime falha
 */
import { useEffect, useRef, useCallback } from 'react';
import { RealtimeChannel, REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';

interface SubscriptionConfig {
  /** Supabase client instance */
  client: any;
  /** Unique channel name */
  channelName: string;
  /** Schema to listen on */
  schema: string;
  /** Table to listen on */
  table: string;
  /** Optional filter (e.g. "chat_id=eq.123") */
  filter?: string;
  /** Events to listen for */
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  /** Callback when a change happens */
  onPayload: (payload: any) => void;
  /** Callback to re-fetch fresh data (used as fallback) */
  onRefresh?: () => void;
  /** Whether the subscription is enabled */
  enabled?: boolean;
  /** Max reconnect attempts before falling back to polling (default: 5) */
  maxReconnectAttempts?: number;
  /** Polling interval in ms when realtime fails (default: 3000) */
  pollingInterval?: number;
}

export function useRealtimeSubscription(config: SubscriptionConfig) {
  const {
    client,
    channelName,
    schema,
    table,
    filter,
    event = '*',
    onPayload,
    onRefresh,
    enabled = true,
    maxReconnectAttempts = 5,
    pollingInterval = 3000,
  } = config;

  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSubscribedRef = useRef(false);
  const isMountedRef = useRef(true);
  const subscribeRef = useRef<() => void>(() => {});

  // Stable refs for callbacks — synced via effects to avoid render-time ref access
  const onPayloadRef = useRef(onPayload);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => { onPayloadRef.current = onPayload; }, [onPayload]);
  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);

  const startPolling = useCallback(() => {
    if (pollingTimerRef.current) return;
    pollingTimerRef.current = setInterval(() => {
      if (isMountedRef.current && onRefreshRef.current) {
        onRefreshRef.current();
      }
    }, pollingInterval);
  }, [pollingInterval]);

  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    stopPolling();
    if (channelRef.current) {
      client.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    isSubscribedRef.current = false;
  }, [client, stopPolling]);

  const subscribe = useCallback(() => {
    if (!isMountedRef.current || !enabled) return;

    // Clean up existing channel
    if (channelRef.current) {
      client.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channelConfig: any = {
      event,
      schema,
      table,
    };
    if (filter) channelConfig.filter = filter;

    const channel = client
      .channel(channelName)
      .on('postgres_changes', channelConfig, (payload: any) => {
        if (isMountedRef.current) {
          onPayloadRef.current(payload);
        }
      })
      .subscribe((status: `${REALTIME_SUBSCRIBE_STATES}`, err?: Error) => {
        if (!isMountedRef.current) return;

        if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
          isSubscribedRef.current = true;
          reconnectAttemptsRef.current = 0;
          stopPolling();
          // Fetch fresh data after reconnect to catch missed events
          if (onRefreshRef.current) {
            onRefreshRef.current();
          }
        }

        if (
          status === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR ||
          status === REALTIME_SUBSCRIBE_STATES.TIMED_OUT
        ) {
          console.warn(
            `[Realtime] ${channelName} — ${status}${err ? `: ${err.message}` : ''}. Attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts}`
          );
          isSubscribedRef.current = false;

          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 16000);
            reconnectAttemptsRef.current++;

            reconnectTimerRef.current = setTimeout(() => {
              if (isMountedRef.current) {
                subscribeRef.current();
              }
            }, delay);
          } else {
            console.warn(
              `[Realtime] ${channelName} — Max reconnect attempts reached. Falling back to polling every ${pollingInterval}ms`
            );
            startPolling();
          }
        }

        if (status === REALTIME_SUBSCRIBE_STATES.CLOSED) {
          isSubscribedRef.current = false;
        }
      });

    channelRef.current = channel;
  }, [
    client, channelName, schema, table, filter, event, enabled,
    maxReconnectAttempts, pollingInterval, startPolling, stopPolling,
  ]);

  // Keep ref in sync via effect
  useEffect(() => { subscribeRef.current = subscribe; }, [subscribe]);

  // Main subscription effect
  useEffect(() => {
    isMountedRef.current = true;
    reconnectAttemptsRef.current = 0;

    if (enabled) {
      subscribe();
    }

    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, [enabled, subscribe, cleanup]);

  // Visibility change handler — recover when tab becomes visible
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (!isSubscribedRef.current) {
          reconnectAttemptsRef.current = 0;
          subscribeRef.current();
        } else if (onRefreshRef.current) {
          onRefreshRef.current();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [enabled]);

  // Online/offline handler
  useEffect(() => {
    if (!enabled) return;

    const handleOnline = () => {
      reconnectAttemptsRef.current = 0;
      stopPolling();
      subscribeRef.current();
    };

    const handleOffline = () => {
      isSubscribedRef.current = false;
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [enabled, stopPolling]);
}
