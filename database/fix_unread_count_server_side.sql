-- Garante que unread_count seja sempre atualizado no servidor
-- para qualquer inserção de mensagem recebida, independentemente
-- do frontend estar aberto.

CREATE OR REPLACE FUNCTION public.handle_chat_message_unread_counter()
RETURNS TRIGGER AS $$
DECLARE
  is_incoming BOOLEAN;
  sender_normalized TEXT;
  preview_text TEXT;
BEGIN
  sender_normalized := UPPER(COALESCE(NEW.sender, ''));
  is_incoming := sender_normalized NOT IN ('HUMAN_AGENT', 'AI_AGENT', 'ME');

  preview_text := CASE
    WHEN NEW.message_type = 'audio' THEN 'Áudio'
    WHEN NEW.message_type = 'image' THEN 'Foto'
    WHEN NEW.message_type = 'video' THEN 'Vídeo'
    WHEN NEW.message_type = 'sticker' THEN 'Figurinha'
    WHEN NEW.message_type = 'document' THEN 'Documento'
    ELSE COALESCE(NULLIF(TRIM(NEW.message_text), ''), '')
  END;

  UPDATE public.chats
  SET
    last_message = preview_text,
    last_message_type = COALESCE(NEW.message_type, 'text'),
    last_message_sender = CASE WHEN is_incoming THEN 'contact' ELSE 'me' END,
    last_interaction_at = COALESCE(NEW.created_at, NOW()),
    unread_count = CASE
      WHEN is_incoming THEN COALESCE(unread_count, 0) + 1
      ELSE COALESCE(unread_count, 0)
    END
  WHERE id = NEW.chat_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chat_messages_unread_counter ON public.chat_messages;
CREATE TRIGGER trg_chat_messages_unread_counter
AFTER INSERT ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.handle_chat_message_unread_counter();
