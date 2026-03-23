CREATE OR REPLACE FUNCTION match_memories(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.65,
  match_count int DEFAULT 10
)
RETURNS TABLE (id int, content text, memory_type text, quality_score int, updated_at timestamptz, similarity float)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT cm.id, cm.content, cm.memory_type, cm.quality_score, cm.updated_at,
    1 - (cm.embedding <=> query_embedding) AS similarity
  FROM clara_memories cm
  WHERE cm.archived = false
    AND 1 - (cm.embedding <=> query_embedding) > match_threshold
  ORDER BY cm.embedding <=> query_embedding
  LIMIT match_count;
END; $$;
