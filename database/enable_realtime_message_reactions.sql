-- Ativa realtime da tabela de reações no Supabase
-- Execute após criar public.message_reactions

ALTER TABLE IF EXISTS public.message_reactions REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'message_reactions'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions';
    END IF;
  END IF;
END $$;
