-- Adiciona colunas para confirmação de entrega e leitura (Evolution API MESSAGES_UPDATE)

-- Status em chat_messages: sent | delivered | read (NULL = mensagem recebida)
ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS status TEXT;

ALTER TABLE public.chat_messages DROP CONSTRAINT IF EXISTS chat_messages_status_check;
ALTER TABLE public.chat_messages 
ADD CONSTRAINT chat_messages_status_check 
CHECK (status IS NULL OR status IN ('sent', 'delivered', 'read'));

COMMENT ON COLUMN public.chat_messages.status IS 'Status de confirmação: sent=enviado, delivered=entregue, read=lido (NULL para mensagens recebidas)';

-- Colunas de preview em chats (para sidebar com checks estilo WhatsApp)
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS last_message TEXT;
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS last_message_type TEXT;
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS last_message_sender TEXT;
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS last_message_status TEXT;
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS last_message_data JSONB;

ALTER TABLE public.chats DROP CONSTRAINT IF EXISTS chats_last_message_status_check;
ALTER TABLE public.chats 
ADD CONSTRAINT chats_last_message_status_check 
CHECK (last_message_status IS NULL OR last_message_status IN ('sent', 'delivered', 'read'));

COMMENT ON COLUMN public.chats.last_message_status IS 'Status da última mensagem enviada por nós (para checks na sidebar)';
