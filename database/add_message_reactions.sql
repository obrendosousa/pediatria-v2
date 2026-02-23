-- Reações em mensagens WhatsApp (Evolution)

CREATE TABLE IF NOT EXISTS public.message_reactions (
  id BIGSERIAL PRIMARY KEY,
  chat_id BIGINT NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  message_id BIGINT REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  target_wpp_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  sender_phone TEXT,
  sender_name TEXT,
  from_me BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_message_reactions_target_sender
  ON public.message_reactions(target_wpp_id, sender_phone, from_me);

CREATE INDEX IF NOT EXISTS idx_message_reactions_chat_id
  ON public.message_reactions(chat_id);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id
  ON public.message_reactions(message_id)
  WHERE message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_message_reactions_target_wpp_id
  ON public.message_reactions(target_wpp_id);

CREATE OR REPLACE FUNCTION public.set_message_reactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_message_reactions_updated_at ON public.message_reactions;
CREATE TRIGGER trg_message_reactions_updated_at
  BEFORE UPDATE ON public.message_reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_message_reactions_updated_at();

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'current_user_has_approved_profile'
      AND n.nspname = 'public'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Approved users full access" ON public.message_reactions';
    EXECUTE 'CREATE POLICY "Approved users full access" ON public.message_reactions
      FOR ALL
      USING (public.current_user_has_approved_profile())
      WITH CHECK (public.current_user_has_approved_profile())';
  END IF;
END $$;
