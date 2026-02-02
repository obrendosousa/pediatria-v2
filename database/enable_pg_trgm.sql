-- Ativar extensão pg_trgm para busca fuzzy (similaridade de texto)
-- Esta extensão permite buscas tolerantes a erros de digitação usando trigramas

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Verificar se a extensão foi criada
SELECT * FROM pg_extension WHERE extname = 'pg_trgm';

COMMENT ON EXTENSION pg_trgm IS 'Extensão PostgreSQL para busca de similaridade de texto usando trigramas';
