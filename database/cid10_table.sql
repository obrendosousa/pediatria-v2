-- Tabela para armazenar códigos CID-10 (Classificação Internacional de Doenças)
-- Esta tabela será populada com dados do CID-10 brasileiro

CREATE TABLE IF NOT EXISTS public.cid10 (
  id BIGSERIAL NOT NULL,
  code TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT cid10_pkey PRIMARY KEY (id),
  CONSTRAINT cid10_code_unique UNIQUE (code)
) TABLESPACE pg_default;

-- Índice para busca rápida por código
CREATE INDEX IF NOT EXISTS idx_cid10_code ON public.cid10 USING btree (code) TABLESPACE pg_default;

-- Índice GIN para busca full-text na descrição
CREATE INDEX IF NOT EXISTS idx_cid10_description_search ON public.cid10 USING gin (to_tsvector('portuguese', description)) TABLESPACE pg_default;

-- Índice composto para busca otimizada
CREATE INDEX IF NOT EXISTS idx_cid10_code_description ON public.cid10 USING btree (code, description) TABLESPACE pg_default;

-- Comentários
COMMENT ON TABLE public.cid10 IS 'Tabela de códigos CID-10 para busca de diagnósticos';
COMMENT ON COLUMN public.cid10.code IS 'Código CID-10 (ex: A09, K58)';
COMMENT ON COLUMN public.cid10.description IS 'Descrição completa do diagnóstico';

-- Exemplo de inserção (você precisará popular com dados reais do CID-10):
-- INSERT INTO public.cid10 (code, description) VALUES
-- ('A09', 'Diarréia e gastroenterite de origem infecciosa presumível'),
-- ('K58', 'Síndrome do cólon irritável'),
-- ('K580', 'Síndrome do cólon irritável com diarréia'),
-- ('K589', 'Síndrome do cólon irritável sem diarréia'),
-- ('K59', 'Outros transtornos funcionais do intestino'),
-- ('K590', 'Constipação'),
-- ('K591', 'Diarréia funcional');
