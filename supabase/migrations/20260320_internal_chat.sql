-- ============================================================================
-- INTERNAL CHAT SYSTEM — Comunicação entre Dra. e Secretárias
-- ============================================================================

-- 1. Tabela de conversas internas
CREATE TABLE IF NOT EXISTS internal_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Participantes da conversa
CREATE TABLE IF NOT EXISTS internal_conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES internal_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

-- 3. Mensagens internas
CREATE TABLE IF NOT EXISTS internal_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES internal_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'document', 'audio', 'video')),
  file_url TEXT,
  file_name TEXT,
  file_size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Índices para performance
CREATE INDEX IF NOT EXISTS idx_internal_messages_conversation ON internal_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_internal_participants_user ON internal_conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_internal_participants_conversation ON internal_conversation_participants(conversation_id);

-- 5. Trigger para atualizar updated_at na conversa quando nova mensagem chegar
CREATE OR REPLACE FUNCTION update_internal_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE internal_conversations SET updated_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_internal_message_update_conversation ON internal_messages;
CREATE TRIGGER trg_internal_message_update_conversation
  AFTER INSERT ON internal_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_internal_conversation_timestamp();

-- 6. RLS (Row Level Security)
ALTER TABLE internal_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_messages ENABLE ROW LEVEL SECURITY;

-- Participantes podem ver suas conversas
CREATE POLICY "Users can view their conversations"
  ON internal_conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM internal_conversation_participants
      WHERE conversation_id = internal_conversations.id
      AND user_id = auth.uid()
    )
  );

-- Qualquer usuário autenticado pode criar conversa
CREATE POLICY "Authenticated users can create conversations"
  ON internal_conversations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Participantes podem ver participantes de suas conversas
CREATE POLICY "Users can view participants of their conversations"
  ON internal_conversation_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM internal_conversation_participants AS p
      WHERE p.conversation_id = internal_conversation_participants.conversation_id
      AND p.user_id = auth.uid()
    )
  );

-- Qualquer autenticado pode adicionar participantes
CREATE POLICY "Authenticated users can add participants"
  ON internal_conversation_participants FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Usuário pode atualizar seu próprio last_read_at
CREATE POLICY "Users can update their own participant record"
  ON internal_conversation_participants FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Participantes podem ver mensagens de suas conversas
CREATE POLICY "Users can view messages in their conversations"
  ON internal_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM internal_conversation_participants
      WHERE conversation_id = internal_messages.conversation_id
      AND user_id = auth.uid()
    )
  );

-- Participantes podem enviar mensagens nas suas conversas
CREATE POLICY "Users can send messages in their conversations"
  ON internal_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM internal_conversation_participants
      WHERE conversation_id = internal_messages.conversation_id
      AND user_id = auth.uid()
    )
  );

-- 7. Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE internal_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE internal_conversation_participants;

-- 8. Storage bucket para arquivos do chat interno
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'internal-chat-files',
  'internal-chat-files',
  true,
  52428800, -- 50MB
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/webm',
    'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated users can upload internal chat files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'internal-chat-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view internal chat files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'internal-chat-files' AND auth.uid() IS NOT NULL);
