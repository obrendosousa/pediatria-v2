import { MemorySaver } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import pg from "pg";

let checkpointerSingleton: MemorySaver | PostgresSaver | null = null;
let checkpointerInitPromise: Promise<MemorySaver | PostgresSaver> | null = null;
let checkpointerModeResolved: "memory" | "postgres" | null = null;
let checkpointerLastError: string | null = null;

type CheckpointerMode = "auto" | "memory" | "postgres";

function getCheckpointerMode(): CheckpointerMode {
  const rawMode = String(process.env.LANGGRAPH_CHECKPOINTER_MODE || "auto").trim().toLowerCase();
  return rawMode === "memory" || rawMode === "postgres" ? rawMode : "auto";
}

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

function markCheckpointer(mode: "memory" | "postgres", error?: unknown) {
  checkpointerModeResolved = mode;
  if (error) {
    checkpointerLastError =
      error instanceof Error ? error.message : typeof error === "string" ? error : "unknown_error";
  }
}

async function createPostgresSaver(connString: string): Promise<PostgresSaver> {
  try {
    const saver = PostgresSaver.fromConnString(connString, { schema: "public" });
    await saver.setup();
    return saver;
  } catch (error) {
    const isCertChainError =
      error instanceof Error && /self-signed certificate/i.test(error.message);
    if (!isCertChainError) throw error;

    const pool = new pg.Pool({
      connectionString: removeSslModeFromConnString(connString),
      ssl: { rejectUnauthorized: false },
    });
    pool.on("error", (poolError) => {
      console.error("[Automation] Postgres checkpointer pool error:", poolError);
    });
    const saver = new PostgresSaver(pool, undefined, { schema: "public" });
    await saver.setup();
    return saver;
  }
}

export async function getAutomationCheckpointer(): Promise<MemorySaver | PostgresSaver> {
  if (checkpointerSingleton) return checkpointerSingleton;
  if (checkpointerInitPromise) return checkpointerInitPromise;

  checkpointerInitPromise = (async () => {
    const mode = getCheckpointerMode();
    const connString = process.env.LANGGRAPH_CHECKPOINT_POSTGRES_URI || process.env.DATABASE_URL;
    if (mode === "memory") {
      checkpointerSingleton = new MemorySaver();
      markCheckpointer("memory");
      return checkpointerSingleton;
    }

    if (!connString) {
      if (mode === "postgres") {
        throw new Error("LANGGRAPH_CHECKPOINT_POSTGRES_URI_or_DATABASE_URL_not_configured");
      }
      checkpointerSingleton = new MemorySaver();
      markCheckpointer("memory");
      return checkpointerSingleton;
    }

    try {
      const saver = await createPostgresSaver(connString);
      checkpointerSingleton = saver;
      markCheckpointer("postgres");
      return checkpointerSingleton;
    } catch (error) {
      if (mode === "postgres") throw error;
      console.warn("[Automation] Falling back to MemorySaver checkpointer.", error);
      checkpointerSingleton = new MemorySaver();
      markCheckpointer("memory", error);
      return checkpointerSingleton;
    }
  })();

  try {
    return await checkpointerInitPromise;
  } finally {
    checkpointerInitPromise = null;
  }
}

export function getAutomationCheckpointerHealth() {
  return {
    mode: checkpointerModeResolved,
    lastError: checkpointerLastError,
  };
}
