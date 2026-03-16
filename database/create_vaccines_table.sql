-- Migration: Tabela de Vacinas
-- Schema: public
-- Usada pela busca de vacinas em receituário/prescrições

CREATE TABLE IF NOT EXISTS vaccines (
  id          BIGSERIAL   PRIMARY KEY,
  name        TEXT        NOT NULL,
  commercial_names TEXT,
  category    TEXT        NOT NULL DEFAULT 'Geral',
  type        TEXT        NOT NULL DEFAULT 'Inativada',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para busca
CREATE INDEX IF NOT EXISTS idx_vaccines_name ON vaccines USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_vaccines_category ON vaccines (category);

-- RLS
ALTER TABLE vaccines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read vaccines"
  ON vaccines FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert vaccines"
  ON vaccines FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update vaccines"
  ON vaccines FOR UPDATE
  TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete vaccines"
  ON vaccines FOR DELETE
  TO authenticated
  USING (true);
