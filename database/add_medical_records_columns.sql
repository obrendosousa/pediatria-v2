-- Script para adicionar colunas faltantes na tabela medical_records
-- Execute este script no SQL Editor do Supabase

-- Adicionar coluna antecedents (Histórico e antecedentes do paciente)
ALTER TABLE public.medical_records 
ADD COLUMN IF NOT EXISTS antecedents TEXT NULL;

-- Adicionar coluna conducts (Condutas e plano de tratamento)
ALTER TABLE public.medical_records 
ADD COLUMN IF NOT EXISTS conducts TEXT NULL;

-- Adicionar comentários para documentação
COMMENT ON COLUMN public.medical_records.antecedents IS 'Histórico e antecedentes do paciente';
COMMENT ON COLUMN public.medical_records.conducts IS 'Condutas e plano de tratamento';

-- Verificar se as colunas foram criadas
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'medical_records' 
AND column_name IN ('antecedents', 'conducts');
