-- Suporte a reply/quoted e edição de mensagens no chat WhatsApp

ALTER TABLE public.chat_messages
ADD COLUMN IF NOT EXISTS quoted_wpp_id TEXT;

ALTER TABLE public.chat_messages
ADD COLUMN IF NOT EXISTS is_edited BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.chat_messages
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_chat_messages_quoted_wpp_id
  ON public.chat_messages(quoted_wpp_id)
  WHERE quoted_wpp_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chat_messages_is_edited
  ON public.chat_messages(is_edited)
  WHERE is_edited = TRUE;

COMMENT ON COLUMN public.chat_messages.quoted_wpp_id IS
  'ID da mensagem original citada em reply (wpp_id da Evolution)';

COMMENT ON COLUMN public.chat_messages.is_edited IS
  'Indica se a mensagem já foi editada após envio';

COMMENT ON COLUMN public.chat_messages.edited_at IS
  'Timestamp da última edição da mensagem';
