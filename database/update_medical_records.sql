-- Atualização da estrutura da tabela medical_records
-- A coluna vitals (JSONB) já existe, apenas documentamos o formato esperado

-- Comentário na coluna vitals para documentar o formato esperado
COMMENT ON COLUMN public.medical_records.vitals IS 'JSONB com estrutura: {"weight": number, "height": number, "imc": number, "pe": number} - peso em kg, altura em cm, IMC calculado, perímetro cefálico em cm';

-- Exemplo de uso:
-- UPDATE medical_records 
-- SET vitals = '{"weight": 70.5, "height": 175, "imc": 23.02, "pe": 55}'::jsonb
-- WHERE id = 1;
