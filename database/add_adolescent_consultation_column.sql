-- Script para adicionar coluna adolescent_consultation na tabela medical_records
-- Esta coluna armazena dados específicos da consulta adolescente em formato JSONB
-- Execute este script no SQL Editor do Supabase

-- Adicionar coluna adolescent_consultation (JSONB)
ALTER TABLE public.medical_records 
ADD COLUMN IF NOT EXISTS adolescent_consultation JSONB NULL;

-- Adicionar comentário para documentação
COMMENT ON COLUMN public.medical_records.adolescent_consultation IS 'Dados específicos da consulta adolescente em formato JSONB. Estrutura: {"companions": string, "lives_where": string, "birthplace": string, "school_turn_consultation_reason": string, "parents_antecedents": string, "personal_antecedents": string, "allergies": string, "hospitalizations": string, "vision_headache_problems": string, "consultation_reason": string (rich text), "feels_anxious": "sim"|"não"|null}';

-- Criar índice GIN para busca eficiente (opcional, mas recomendado)
CREATE INDEX IF NOT EXISTS idx_medical_records_adolescent_consultation 
ON public.medical_records 
USING gin (adolescent_consultation) 
TABLESPACE pg_default;

-- Verificar se a coluna foi criada
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'medical_records' 
AND column_name = 'adolescent_consultation';
