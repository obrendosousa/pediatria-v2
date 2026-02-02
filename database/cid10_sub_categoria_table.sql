-- Tabela para armazenar códigos CID-10 de subcategorias
-- Esta tabela contém os códigos mais específicos da CID-10 (ex: A000, A001, K589)
-- Formato: id (código sem ponto, ex: A000) e descricao (texto completo)

CREATE TABLE IF NOT EXISTS public.cid_sub_categoria (
  id TEXT NOT NULL,
  descricao TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT cid_sub_categoria_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

-- Índice B-tree para busca rápida por código exato
CREATE INDEX IF NOT EXISTS idx_cid_sub_categoria_id_btree 
  ON public.cid_sub_categoria 
  USING btree (id) 
  TABLESPACE pg_default;

-- Índice GIN Trigram para busca fuzzy na descrição
-- Permite encontrar resultados mesmo com erros de digitação
CREATE INDEX IF NOT EXISTS idx_cid_sub_categoria_descricao_gin 
  ON public.cid_sub_categoria 
  USING gin (descricao gin_trgm_ops) 
  TABLESPACE pg_default;

-- Índice GIN Trigram no código também (para erros ao digitar código)
-- Permite encontrar "A00" mesmo digitando "A0O" ou "AOO"
CREATE INDEX IF NOT EXISTS idx_cid_sub_categoria_id_gin 
  ON public.cid_sub_categoria 
  USING gin (id gin_trgm_ops) 
  TABLESPACE pg_default;

-- Comentários
COMMENT ON TABLE public.cid_sub_categoria IS 'Tabela de subcategorias CID-10 para busca de diagnósticos com busca fuzzy';
COMMENT ON COLUMN public.cid_sub_categoria.id IS 'Código CID-10 sem ponto (ex: A000, A001, K589)';
COMMENT ON COLUMN public.cid_sub_categoria.descricao IS 'Descrição completa do diagnóstico';
