-- Adiciona coluna 'blocked' à tabela clinical_evolutions
-- Quando blocked = true, a evolução não pode ser editada ou excluída

ALTER TABLE atendimento.clinical_evolutions
  ADD COLUMN IF NOT EXISTS blocked BOOLEAN DEFAULT false;
