-- Migration: Suporte multi-schema para scheduled_messages
-- Permite que mensagens agendadas do atendimento (clínica geral) sejam
-- processadas pelo mesmo worker dispatch da pediatria.

-- 1. Coluna source_schema: identifica origem (public vs atendimento)
ALTER TABLE public.scheduled_messages
  ADD COLUMN IF NOT EXISTS source_schema TEXT NOT NULL DEFAULT 'public';

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_source_schema
  ON public.scheduled_messages(source_schema);

-- 2. Coluna phone: armazena telefone no momento do agendamento
--    Necessário porque chat_ids de schemas diferentes não fazem JOIN com public.chats
ALTER TABLE public.scheduled_messages
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- 3. Backfill phone para mensagens existentes (via public.chats)
UPDATE public.scheduled_messages sm
SET phone = c.phone
FROM public.chats c
WHERE sm.chat_id = c.id AND sm.phone IS NULL;

-- 4. Dropar FK que impede inserir chat_ids de outros schemas
ALTER TABLE public.scheduled_messages
  DROP CONSTRAINT IF EXISTS scheduled_messages_chat_id_fkey;

-- 5. Remover tabela órfã do schema atendimento (sem colunas LangGraph, sem RPC)
DROP TABLE IF EXISTS atendimento.scheduled_messages;
