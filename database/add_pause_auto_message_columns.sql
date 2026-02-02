-- Script para adicionar colunas de pausa de atendimento
-- Execute este script no SQL Editor do Supabase

-- Adicionar colunas na tabela chats
ALTER TABLE public.chats 
ADD COLUMN IF NOT EXISTS pause_auto_message TEXT NULL,
ADD COLUMN IF NOT EXISTS pause_session_id UUID NULL,
ADD COLUMN IF NOT EXISTS pause_started_at TIMESTAMPTZ NULL;

-- Adicionar coluna na tabela chat_messages
ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS auto_sent_pause_session UUID NULL;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_chats_pause_session_id ON public.chats(pause_session_id) WHERE pause_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chats_is_ai_paused ON public.chats(is_ai_paused) WHERE is_ai_paused = true;
CREATE INDEX IF NOT EXISTS idx_chat_messages_auto_sent_pause_session ON public.chat_messages(auto_sent_pause_session) WHERE auto_sent_pause_session IS NOT NULL;

-- Comentários para documentação
COMMENT ON COLUMN public.chats.pause_auto_message IS 'Mensagem automática configurada para envio durante pausa de atendimento';
COMMENT ON COLUMN public.chats.pause_session_id IS 'UUID único da sessão de pausa atual (gera novo UUID a cada pausa)';
COMMENT ON COLUMN public.chats.pause_started_at IS 'Data e hora em que a pausa foi iniciada';
COMMENT ON COLUMN public.chat_messages.auto_sent_pause_session IS 'UUID da sessão de pausa que enviou esta mensagem automática (para evitar duplicatas)';
