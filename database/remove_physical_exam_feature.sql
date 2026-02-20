-- Limpeza da feature "Exame Fisico" no banco
-- Execute este script no SQL Editor do Supabase

BEGIN;

-- Remove indice legado (caso exista)
DROP INDEX IF EXISTS public.idx_medical_records_physical_exam_data;

-- Remove colunas legadas do prontuario (caso existam)
ALTER TABLE public.medical_records
  DROP COLUMN IF EXISTS physical_exam_data;

-- Remove modelos legados de macros relacionados ao exame fisico
DELETE FROM public.macros
WHERE type IN (
  'physical_exam_general',
  'physical_exam_skin',
  'physical_exam_abdomen',
  'physical_exam_nervous',
  'physical_exam_genitals'
);

COMMIT;
