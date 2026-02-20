-- Restauracao apos limpeza antiga que removeu "physical_exam" por engano
-- Execute este script no SQL Editor do Supabase

BEGIN;

-- 1) Recria a coluna de exame fisico no prontuario (estrutura)
ALTER TABLE public.medical_records
  ADD COLUMN IF NOT EXISTS physical_exam TEXT NULL;

COMMENT ON COLUMN public.medical_records.physical_exam IS
  'Exame fisico em texto rico (HTML) do atendimento';

-- 2) Garante a documentacao de tipos de macro incluindo physical_exam
COMMENT ON COLUMN public.macros.type IS
  'Tipo do modelo: "physical_exam", "anamnesis", "conduct", "hda", "antecedents", ou outros tipos customizados';

-- 3) (Opcional) Cria um modelo padrao somente se nao houver nenhum do tipo
INSERT INTO public.macros (title, type, content, category)
SELECT
  'Modelo Exame Fisico Padrao',
  'physical_exam',
  '<p>Exame fisico sem alteracoes relevantes ao momento.</p>',
  'geral'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.macros
  WHERE type = 'physical_exam'
);

COMMIT;
