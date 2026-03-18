-- Adiciona colunas faltantes na tabela atendimento.chat_messages
-- Estas colunas já existem no schema public, mas estavam faltando no schema atendimento,
-- causando erros "Could not find column in schema cache" e perda de mensagens.

-- 1. quoted_wpp_id: referência ao wpp_id da mensagem citada (reply-to)
ALTER TABLE atendimento.chat_messages
  ADD COLUMN IF NOT EXISTS quoted_wpp_id TEXT;

-- 2. is_edited: flag de mensagem editada
ALTER TABLE atendimento.chat_messages
  ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false;

-- 3. edited_at: timestamp da última edição
ALTER TABLE atendimento.chat_messages
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

-- 4. Índice único no wpp_id para garantir idempotência (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'atendimento'
      AND tablename = 'chat_messages'
      AND indexname = 'idx_atd_chat_messages_wpp_id'
  ) THEN
    CREATE UNIQUE INDEX idx_atd_chat_messages_wpp_id
      ON atendimento.chat_messages (wpp_id)
      WHERE wpp_id IS NOT NULL;
  END IF;
END $$;

-- 5. Constraint UNIQUE no phone da tabela chats para prevenir duplicatas
-- (não pode usar ADD CONSTRAINT IF NOT EXISTS diretamente, então usamos DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'atendimento'
      AND tablename = 'chats'
      AND indexname = 'idx_atd_chats_phone_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_atd_chats_phone_unique
      ON atendimento.chats (phone)
      WHERE phone IS NOT NULL AND phone != '';
  END IF;
END $$;

-- 6. Constraint UNIQUE no phone da tabela public.chats também
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'chats'
      AND indexname = 'idx_pub_chats_phone_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_pub_chats_phone_unique
      ON public.chats (phone)
      WHERE phone IS NOT NULL AND phone != '';
  END IF;
END $$;

-- 7. Notificar para que o PostgREST recarregue o schema cache
NOTIFY pgrst, 'reload schema';
