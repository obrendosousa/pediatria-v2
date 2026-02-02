-- Script para adicionar coluna routine_consultation na tabela medical_records
-- Esta coluna armazena dados específicos da consulta de rotina em formato JSONB
-- Execute este script no SQL Editor do Supabase

-- Adicionar coluna routine_consultation (JSONB)
ALTER TABLE public.medical_records 
ADD COLUMN IF NOT EXISTS routine_consultation JSONB NULL;

-- Adicionar comentário para documentação
COMMENT ON COLUMN public.medical_records.routine_consultation IS 'Dados específicos da consulta de rotina em formato JSONB. Estrutura: {"caregivers_name": string, "companion_location": string, "support_network": string, "school_info": string, "siblings_info": string, "allergies_interactions": string, "consultation_reason": string (rich text), "breathing_info": string, "medications": string, "breastfeeding_formula": string, "vaccines_up_to_date": "sim"|"não"|null, "delayed_vaccine": string, "uses_pacifier": string, "nose_wash": string, "skin_products": string, "dental_info": string, "gastrointestinal": string, "genitourinary": string, "nervous_system": string, "screen_exposure": string, "sleep_info": string (rich text), "monthly_milestones": "sim"|"não"|null, "exam_results": string (rich text), "print_development_guide": "sim"|"não"|null}';

-- Criar índice GIN para busca eficiente (opcional, mas recomendado)
CREATE INDEX IF NOT EXISTS idx_medical_records_routine_consultation 
ON public.medical_records 
USING gin (routine_consultation) 
TABLESPACE pg_default;

-- Verificar se a coluna foi criada
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'medical_records' 
AND column_name = 'routine_consultation';
