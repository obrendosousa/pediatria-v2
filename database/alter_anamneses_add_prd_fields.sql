-- Migração: Adicionar campos do PRD à tabela anamneses
-- Schema: atendimento
-- Totalmente idempotente

-- Campos de preenchimento
ALTER TABLE atendimento.anamneses ADD COLUMN IF NOT EXISTS show_date BOOLEAN DEFAULT true;
ALTER TABLE atendimento.anamneses ADD COLUMN IF NOT EXISTS fill_date DATE;

-- Perguntas dinâmicas (JSON array com text, type, options, answer)
ALTER TABLE atendimento.anamneses ADD COLUMN IF NOT EXISTS questions JSONB;

-- CID-10 associados
ALTER TABLE atendimento.anamneses ADD COLUMN IF NOT EXISTS cid_codes TEXT[];

-- Restrições
ALTER TABLE atendimento.anamneses ADD COLUMN IF NOT EXISTS blocked BOOLEAN DEFAULT false;
ALTER TABLE atendimento.anamneses ADD COLUMN IF NOT EXISTS allowed_professionals INTEGER[];

-- Opções
ALTER TABLE atendimento.anamneses ADD COLUMN IF NOT EXISTS save_as_template BOOLEAN DEFAULT false;
