import { Pool } from "pg";
import * as dotenv from "dotenv";

// Carrega variáveis do .env.local
dotenv.config({ path: ".env.local" });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error("❌ DATABASE_URL não encontrada no .env.local");
    process.exit(1);
}

const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
});

async function setup() {
    console.log("🚀 Iniciando migrações para LangGraph Checkpointer e Semantic Memory...");

    try {
        // 1. O LangGraph Checkpoint Postgres já possui um utilitário interno,
        // mas também podemos criar as tabelas base se ele não fizer isso 
        // automaticamente, ou delegar isso. A classe PostgresSaver.setup() resolve isso.
        const { PostgresSaver } = await import("@langchain/langgraph-checkpoint-postgres");
        const checkpointer = new PostgresSaver(pool);
        console.log("⏳ Configurando tabelas do LangGraph (PostgresSaver)...");
        await checkpointer.setup();
        console.log("✅ Tabelas do LangGraph criadas com sucesso.");

        // 2. Criar a extensão vector e as tabelas de Memória Semântica
        console.log("⏳ Configurando extensão pgvector e tabela semantic_memory...");
        await pool.query(`
      -- Habilita a extensão se não existir
      CREATE EXTENSION IF NOT EXISTS vector;

      -- Tabela principal de memória semântica
      CREATE TABLE IF NOT EXISTS semantic_memory (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_phone TEXT NOT NULL,
        content TEXT NOT NULL,
        embedding vector(768), -- Supondo embeddings do Google GenAI
        source_role TEXT DEFAULT 'system',
        category TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Índices para busca rápida
      CREATE INDEX IF NOT EXISTS idx_semantic_memory_phone ON semantic_memory(patient_phone);

      -- Índice vetorial (HNSW) para o pgvector (otimizado para Google 768d)
      CREATE INDEX IF NOT EXISTS idx_semantic_memory_embedding
      ON semantic_memory USING hnsw (embedding vector_cosine_ops);
    `);
        console.log("✅ Tabela semantic_memory configurada.");

    } catch (error) {
        console.error("❌ Erro ao configurar banco de dados:", error);
    } finally {
        await pool.end();
        console.log("🏁 Finalizado.");
        process.exit(0);
    }
}

setup();
