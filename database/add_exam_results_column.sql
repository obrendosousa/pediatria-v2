-- Script para adicionar coluna exam_results_data na tabela medical_records
-- Esta coluna armazena dados específicos de resultados de exames em formato JSONB
-- Execute este script no SQL Editor do Supabase

-- Adicionar coluna exam_results_data (JSONB)
ALTER TABLE public.medical_records 
ADD COLUMN IF NOT EXISTS exam_results_data JSONB NULL;

-- Adicionar comentário para documentação
COMMENT ON COLUMN public.medical_records.exam_results_data IS 'Dados específicos de resultados de exames em formato JSONB. Estrutura: {"ultrasound": string, "xray": string, "laboratory_observations": string (rich text), "leukocytes": string, "eosinophils": string, "platelets": string, "urea_creatinine": string, "tgo_tgp": string, "vitamins": string, "ferritin_pcr": string, "tsh_t4": string, "eas_uroculture_epf": string, "blood_typing": string, "electrolytes": string, "glucose_insulin": string, "lipidogram": string, "karyotype": string}';

-- Criar índice GIN para busca eficiente (opcional, mas recomendado)
CREATE INDEX IF NOT EXISTS idx_medical_records_exam_results_data 
ON public.medical_records 
USING gin (exam_results_data) 
TABLESPACE pg_default;

-- Verificar se a coluna foi criada
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'medical_records' 
AND column_name = 'exam_results_data';
