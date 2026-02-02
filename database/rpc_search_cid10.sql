-- Função RPC para busca fuzzy de códigos CID-10
-- Busca por código e descrição usando trigramas para tolerar erros de digitação
-- Retorna resultados ordenados por relevância (similaridade)
-- Formata código adicionando ponto quando necessário (A000 -> A00.0)

CREATE OR REPLACE FUNCTION public.search_cid10(search_query TEXT)
RETURNS TABLE (
  code TEXT,
  description TEXT
) 
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  search_term TEXT := LOWER(TRIM(search_query));
BEGIN
  -- Retornar vazio se a busca estiver vazia ou muito curta
  IF search_term IS NULL OR LENGTH(search_term) < 1 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH scored_results AS (
    SELECT 
      csc.id,
      csc.descricao,
      -- Score baseado em diferentes tipos de busca (pesos diferentes)
      CASE
        -- Busca exata no código (peso mais alto: 1000)
        WHEN LOWER(csc.id) = search_term THEN 1000
        -- Busca que começa com o código (peso alto: 500)
        WHEN LOWER(csc.id) LIKE search_term || '%' THEN 500
        -- Busca parcial no código (peso médio: 300)
        WHEN LOWER(csc.id) LIKE '%' || search_term || '%' THEN 300
        -- Similaridade no código usando trigramas (peso médio-alto: 200)
        WHEN similarity(LOWER(csc.id), search_term) > 0.3 THEN 200 * similarity(LOWER(csc.id), search_term)
        ELSE 0
      END +
      CASE
        -- Busca exata na descrição (peso alto: 400)
        WHEN LOWER(csc.descricao) = search_term THEN 400
        -- Busca que começa com a descrição (peso médio: 200)
        WHEN LOWER(csc.descricao) LIKE search_term || '%' THEN 200
        -- Busca parcial na descrição (peso baixo-médio: 100)
        WHEN LOWER(csc.descricao) LIKE '%' || search_term || '%' THEN 100
        -- Similaridade na descrição usando trigramas (peso baixo: 50)
        WHEN similarity(LOWER(csc.descricao), search_term) > 0.2 THEN 50 * similarity(LOWER(csc.descricao), search_term)
        ELSE 0
      END AS relevance_score
    FROM public.cid_sub_categoria csc
    WHERE 
      -- Busca por código
      LOWER(csc.id) LIKE '%' || search_term || '%'
      OR similarity(LOWER(csc.id), search_term) > 0.2
      -- Busca por descrição
      OR LOWER(csc.descricao) LIKE '%' || search_term || '%'
      OR similarity(LOWER(csc.descricao), search_term) > 0.2
  )
  SELECT 
    -- Formatar código: inserir ponto antes do último dígito se tiver 4 caracteres
    CASE 
      WHEN LENGTH(sr.id) = 4 THEN 
        LEFT(sr.id, 3) || '.' || RIGHT(sr.id, 1)
      ELSE 
        sr.id
    END AS code,
    sr.descricao AS description
  FROM scored_results sr
  WHERE sr.relevance_score > 0
  ORDER BY sr.relevance_score DESC, sr.id ASC
  LIMIT 50;
END;
$$;

-- Comentários
COMMENT ON FUNCTION public.search_cid10 IS 'Busca fuzzy de códigos CID-10 por código ou descrição usando trigramas. Retorna até 50 resultados ordenados por relevância.';
COMMENT ON PARAMETER public.search_cid10.search_query IS 'Termo de busca (código ou descrição)';

-- Teste da função (pode ser removido após validação)
-- SELECT * FROM public.search_cid10('gastroenterite');
-- SELECT * FROM public.search_cid10('A00');
-- SELECT * FROM public.search_cid10('K58');
