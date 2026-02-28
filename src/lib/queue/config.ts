import { Queue } from "bullmq";
import IORedis from "ioredis";

// Conexão lazy com o Redis — só conecta quando realmente necessário
let _redisConnection: IORedis | null = null;
let _automationQueue: Queue | null = null;

function getRedisConnection(): IORedis {
  if (!_redisConnection) {
    const url = process.env.REDIS_URL;
    if (!url) {
      console.warn(
        "⚠️ [Queue] REDIS_URL não configurada. A fila de automações ficará indisponível."
      );
      throw new Error("REDIS_URL não configurada. Redis indisponível.");
    }
    _redisConnection = new IORedis(url, {
      maxRetriesPerRequest: null,
      retryStrategy(times) {
        // Tenta reconectar com backoff, mas desiste após 10 tentativas
        if (times > 10) {
          console.error("❌ [Queue] Redis: Desistindo após 10 tentativas de reconexão.");
          return null;
        }
        return Math.min(times * 500, 5000);
      },
      lazyConnect: true,
    });

    _redisConnection.on("error", (err) => {
      console.error("🚨 [Queue] Erro de conexão com Redis:", err.message);
    });
  }
  return _redisConnection;
}

/**
 * Retorna a fila de automações. Só cria a conexão com Redis sob demanda.
 * Lança erro se REDIS_URL não estiver configurada.
 */
export function getAutomationQueue(): Queue {
  if (!_automationQueue) {
    _automationQueue = new Queue("automation-jobs", {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    });
  }
  return _automationQueue;
}

/**
 * @deprecated Use getAutomationQueue() em vez disso.
 * Mantido para compatibilidade — agora é um getter lazy.
 */
export const automationQueue = new Proxy({} as Queue, {
  get(_target, prop) {
    return (getAutomationQueue() as any)[prop];
  },
});