-- Adiciona timestamp de criação dos drafts do copiloto para expiração temporal
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS ai_draft_created_at timestamptz;
ALTER TABLE atendimento.chats ADD COLUMN IF NOT EXISTS ai_draft_created_at timestamptz;
