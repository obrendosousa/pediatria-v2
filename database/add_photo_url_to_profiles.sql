-- Adiciona campo de foto de perfil à tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS photo_url TEXT;
COMMENT ON COLUMN public.profiles.photo_url IS 'URL da foto de perfil do usuário (Supabase Storage)';
