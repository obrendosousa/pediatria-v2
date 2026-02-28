import { Pool } from "pg";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const databaseUrl = process.env.DATABASE_URL;

// Fix for Supabase Local/Dev environments using self-signed certificates in Node.js >= 20
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

if (!databaseUrl) {
    throw new Error("DATABASE_URL não configurada. O checkpointer Postgres não funcionará.");
}

// Cria um pool de conexões otimizado para produção.
// Desabilitamos a verificação estrita de SSL apenas se necessário (alguns bancos na nuvem exigem).
// O Next.js cria e reaproveita esse cache para não estourar conexões.
const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
});

// A classe PostgresSaver será a responsável por gravar o estado (Short-term Memory).
export const postgresCheckpointer = new PostgresSaver(pool);
