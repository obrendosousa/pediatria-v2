-- Script para adicionar coluna diagnostic_hypothesis_data na tabela medical_records
-- Esta coluna armazena dados específicos de hipótese diagnóstica em formato JSONB
-- Execute este script no SQL Editor do Supabase

-- Adicionar coluna diagnostic_hypothesis_data (JSONB)
ALTER TABLE public.medical_records 
ADD COLUMN IF NOT EXISTS diagnostic_hypothesis_data JSONB NULL;

-- Adicionar comentário para documentação
COMMENT ON COLUMN public.medical_records.diagnostic_hypothesis_data IS 'Dados específicos de hipótese diagnóstica em formato JSONB. Estrutura: {"observations": string (rich text)}';

-- Criar índice GIN para busca eficiente (opcional, mas recomendado)
CREATE INDEX IF NOT EXISTS idx_medical_records_diagnostic_hypothesis_data 
ON public.medical_records 
USING gin (diagnostic_hypothesis_data) 
TABLESPACE pg_default;

-- Verificar se a coluna foi criada
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'medical_records' 
AND column_name = 'diagnostic_hypothesis_data';
