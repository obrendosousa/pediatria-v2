-- Idempotência forte no banco para evitar duplicatas por corrida.
-- IMPORTANTE: executar fora de transação (CONCURRENTLY).
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_chat_messages_wpp_id_not_null
ON public.chat_messages (wpp_id)
WHERE wpp_id IS NOT NULL
  AND btrim(wpp_id) <> '';
