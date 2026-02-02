-- Tabela para armazenar mensagens salvas para chamadas
-- Execute este script no SQL Editor do Supabase

CREATE TABLE IF NOT EXISTS public.saved_call_messages (
  id BIGSERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para performance
CREATE INDEX IF NOT EXISTS idx_saved_call_messages_created_at ON public.saved_call_messages(created_at DESC);

-- Comentários
COMMENT ON TABLE public.saved_call_messages IS 'Mensagens salvas para uso rápido em chamadas de pacientes';
COMMENT ON COLUMN public.saved_call_messages.content IS 'Conteúdo da mensagem salva';
COMMENT ON COLUMN public.saved_call_messages.created_at IS 'Data de criação da mensagem';

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_saved_call_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_saved_call_messages_updated_at
BEFORE UPDATE ON public.saved_call_messages
FOR EACH ROW
EXECUTE FUNCTION update_saved_call_messages_updated_at();
