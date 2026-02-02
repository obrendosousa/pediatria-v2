-- Script para adicionar coluna patient_sex na tabela appointments
-- Execute este script no SQL Editor do Supabase

-- Adicionar coluna patient_sex (Sexo biológico do paciente)
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS patient_sex TEXT NULL;

-- Adicionar comentário para documentação
COMMENT ON COLUMN public.appointments.patient_sex IS 'Sexo biológico do paciente: M (masculino) ou F (feminino)';

-- Verificar se a coluna foi criada
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'appointments' 
AND column_name = 'patient_sex';
