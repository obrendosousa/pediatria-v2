// Embedding constants — single source of truth
export const EMBEDDING_MODEL = 'gemini-embedding-001';
export const EMBEDDING_DIMS = 768;

// Memory thresholds
export const THRESHOLD_RETRIEVAL_AUTO = 0.65;   // load_context.ts auto-RAG
export const THRESHOLD_RETRIEVAL_MANUAL = 0.70; // manage_long_term_memory consulta
export const THRESHOLD_DEDUP_SAVE = 0.80;       // upsert semântico ao salvar
export const THRESHOLD_VAULT_SEARCH = 0.65;     // vault semantic search

// Re-ranking weights
export const RERANK_SIMILARITY_WEIGHT = 0.65;
export const RERANK_QUALITY_WEIGHT = 0.25;
export const RERANK_RECENCY_WEIGHT = 0.10;
