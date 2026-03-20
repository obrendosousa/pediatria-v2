import { Pool } from "pg";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

// Fix for Supabase Local/Dev environments using self-signed certificates in Node.js >= 20
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

let _checkpointer: PostgresSaver | null = null;

/**
 * Lazy initialization do checkpointer Postgres.
 * Não crasha na importação se DATABASE_URL estiver ausente.
 */
export function getPostgresCheckpointer(): PostgresSaver {
  if (_checkpointer) return _checkpointer;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL não configurada. O checkpointer Postgres não funcionará.");
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  _checkpointer = new PostgresSaver(pool);
  return _checkpointer;
}

// Compat: manter export antigo como getter lazy
export const postgresCheckpointer = new Proxy({} as PostgresSaver, {
  get(_target, prop) {
    return Reflect.get(getPostgresCheckpointer(), prop);
  },
});
