-- Adicionar coluna profile_pic na tabela chats (foto de perfil do contato via Evolution API)
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS profile_pic TEXT;

COMMENT ON COLUMN public.chats.profile_pic IS 'URL da foto de perfil do contato no WhatsApp (via Evolution API fetchProfilePictureUrl)';
