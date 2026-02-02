-- Atualização da tabela macros para suportar tipos de modelos
-- A coluna type já existe, apenas documentamos os valores esperados

-- Comentário na coluna type para documentar os tipos de modelos
COMMENT ON COLUMN public.macros.type IS 'Tipo do modelo: "physical_exam", "anamnesis", "conduct", "hda", "antecedents", ou outros tipos customizados';

-- Exemplo de uso:
-- INSERT INTO macros (title, type, content, category) VALUES
-- ('Modelo Exame Físico Padrão', 'physical_exam', '<p>Exame físico normal...</p>', 'geral'),
-- ('Modelo Anamnese Geral', 'anamnesis', '<p>Paciente relata...</p>', 'geral'),
-- ('Modelo Condutas Comuns', 'conduct', '<p>Orientações gerais...</p>', 'geral');
