-- Passo 1: Atualização do Banco de Dados (Supabase + pgvector)

-- 1. Habilitar a extensão pgvector no Supabase
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Atualizar a tabela clara_memories
-- Adiciona a coluna com model text-embedding-004 de 768 dimensões
ALTER TABLE clara_memories ADD COLUMN IF NOT EXISTS embedding vector(768);
ALTER TABLE clara_memories ADD COLUMN IF NOT EXISTS source_role text DEFAULT 'system';
ALTER TABLE clara_memories ADD COLUMN IF NOT EXISTS frequencia integer DEFAULT 1;
ALTER TABLE clara_memories ADD COLUMN IF NOT EXISTS evidence_chats integer[];
ALTER TABLE clara_memories ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- 3. Criar a tabela chat_insights (Opcional, para o Analista)
CREATE TABLE IF NOT EXISTS chat_insights (
    id serial PRIMARY KEY,
    chat_id integer NOT NULL,
    topico text,
    decisao text,
    objecao_principal text,
    sentimento text,
    desvio_processo boolean DEFAULT false,
    novo_conhecimento boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

-- 4. Criar a function match_memories para o Upsert Semântico
CREATE OR REPLACE FUNCTION match_memories(
    query_embedding vector(768),
    match_threshold float,
    match_count int DEFAULT 5
)
RETURNS TABLE (
    id bigint, -- ou o seu tipo atual de ID em clara_memories (uuid ou serial)
    content text,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        clara_memories.id,
        clara_memories.content,
        1 - (clara_memories.embedding <=> query_embedding) AS similarity
    FROM clara_memories
    WHERE 1 - (clara_memories.embedding <=> query_embedding) > match_threshold
    ORDER BY clara_memories.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
