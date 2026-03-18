-- Tabela de logs de webhooks para debug de mensagens perdidas
-- Armazena TODOS os webhooks recebidos (processados e ignorados)

CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  schema_source TEXT NOT NULL DEFAULT 'public', -- 'public' ou 'atendimento'
  event TEXT,
  status TEXT NOT NULL, -- 'processed', 'ignored', 'error'
  reason TEXT, -- motivo do descarte ou erro
  remote_jid TEXT,
  phone TEXT,
  message_type TEXT,
  push_name TEXT,
  wpp_id TEXT,
  payload JSONB, -- corpo completo do webhook (truncado a 10KB)
  resolver_info JSONB -- info de resolução LID, filtros aplicados, etc.
);

-- Índices para consulta rápida
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON public.webhook_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_phone ON public.webhook_logs (phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status ON public.webhook_logs (status);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_remote_jid ON public.webhook_logs (remote_jid) WHERE remote_jid IS NOT NULL;

-- Auto-limpeza: remover logs com mais de 7 dias (via cron ou trigger)
-- Por enquanto, limpar manualmente: DELETE FROM webhook_logs WHERE created_at < NOW() - INTERVAL '7 days';

-- RLS desabilitado para service_role acessar livremente
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.webhook_logs
  FOR ALL USING (true) WITH CHECK (true);

-- Grant para service_role e authenticated
GRANT ALL ON public.webhook_logs TO service_role;
GRANT SELECT ON public.webhook_logs TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.webhook_logs_id_seq TO service_role;

NOTIFY pgrst, 'reload schema';
