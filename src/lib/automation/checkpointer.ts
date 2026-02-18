import { MemorySaver } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import pg from "pg";

let checkpointerSingleton: MemorySaver | PostgresSaver | null = null;
let checkpointerInitPromise: Promise<MemorySaver | PostgresSaver> | null = null;

function removeSslModeFromConnString(connString: string): string {
  try {
    const url = new URL(connString);
    url.searchParams.delete("sslmode");
    url.searchParams.delete("ssl");
    return url.toString();
  } catch {
    return connString;
  }
}

export async function getAutomationCheckpointer(): Promise<MemorySaver | PostgresSaver> {
  if (checkpointerSingleton) return checkpointerSingleton;
  if (checkpointerInitPromise) return checkpointerInitPromise;

  checkpointerInitPromise = (async () => {
    const connString = process.env.LANGGRAPH_CHECKPOINT_POSTGRES_URI || process.env.DATABASE_URL;
    if (!connString) {
      checkpointerSingleton = new MemorySaver();
      return checkpointerSingleton;
    }

    try {
      const saver = PostgresSaver.fromConnString(connString, { schema: "public" });
      await saver.setup();
      checkpointerSingleton = saver;
      return checkpointerSingleton;
    } catch (error) {
      const isCertChainError =
        error instanceof Error && /self-signed certificate/i.test(error.message);
      if (!isCertChainError) throw error;

      const pool = new pg.Pool({
        connectionString: removeSslModeFromConnString(connString),
        ssl: { rejectUnauthorized: false },
      });
      const saver = new PostgresSaver(pool, undefined, { schema: "public" });
      await saver.setup();
      checkpointerSingleton = saver;
      return checkpointerSingleton;
    }
  })();

  try {
    return await checkpointerInitPromise;
  } finally {
    checkpointerInitPromise = null;
  }
}
