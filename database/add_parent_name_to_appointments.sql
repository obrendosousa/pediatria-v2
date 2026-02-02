-- Script para adicionar coluna parent_name na tabela appointments
-- Execute este script no SQL Editor do Supabase

-- Adicionar coluna parent_name (Nome do responsável)
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS parent_name TEXT NULL;

-- Adicionar comentário para documentação
COMMENT ON COLUMN public.appointments.parent_name IS 'Nome do responsável/pai/mãe do paciente';

-- Verificar se a coluna foi criada
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'appointments' 
AND column_name = 'parent_name';
