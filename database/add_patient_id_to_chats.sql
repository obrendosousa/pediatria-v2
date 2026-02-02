-- Adicionar coluna patient_id na tabela chats
-- Execute este script no SQL Editor do Supabase

ALTER TABLE public.chats 
ADD COLUMN IF NOT EXISTS patient_id BIGINT REFERENCES patients(id) ON DELETE SET NULL;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_chats_patient_id ON public.chats(patient_id);

-- Comentário para documentação
COMMENT ON COLUMN public.chats.patient_id IS 'ID do paciente vinculado ao chat (FK para patients)';
