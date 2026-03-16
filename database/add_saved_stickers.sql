-- Tabela para figurinhas salvas (compartilhada entre módulos)
-- Executar no schema public

CREATE TABLE IF NOT EXISTS saved_stickers (
  id BIGSERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT saved_stickers_url_unique UNIQUE (url)
);

-- RLS: permite leitura/escrita para usuários autenticados
ALTER TABLE saved_stickers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read saved_stickers"
  ON saved_stickers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert saved_stickers"
  ON saved_stickers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete saved_stickers"
  ON saved_stickers FOR DELETE
  TO authenticated
  USING (true);
