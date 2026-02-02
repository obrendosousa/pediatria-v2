-- Script para adicionar coluna physical_exam_data na tabela medical_records
-- Esta coluna armazena dados específicos do exame físico em formato JSONB
-- Execute este script no SQL Editor do Supabase

-- Adicionar coluna physical_exam_data (JSONB)
ALTER TABLE public.medical_records 
ADD COLUMN IF NOT EXISTS physical_exam_data JSONB NULL;

-- Adicionar comentário para documentação
COMMENT ON COLUMN public.medical_records.physical_exam_data IS 'Dados específicos do exame físico em formato JSONB. Estrutura: {"general_exam": string (rich text), "otoscopy": string, "mouth_throat_exam": string, "skin_mucosa_exam": string (rich text), "head_neck_exam": string, "respiratory_exam": string, "abdomen_exam": string (rich text), "nervous_system_exam": string (rich text), "genitals_exam": string (rich text)}';

-- Criar índice GIN para busca eficiente (opcional, mas recomendado)
CREATE INDEX IF NOT EXISTS idx_medical_records_physical_exam_data 
ON public.medical_records 
USING gin (physical_exam_data) 
TABLESPACE pg_default;

-- Verificar se a coluna foi criada
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'medical_records' 
AND column_name = 'physical_exam_data';
