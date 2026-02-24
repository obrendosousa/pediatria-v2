import { Queue } from "bullmq";
import IORedis from "ioredis";

// Conexão com o Redis (será configurada na variável de ambiente no Easypanel)
const redisConnection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

// Criação da fila principal de automações
export const automationQueue = new Queue("automation-jobs", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3, // Se o worker falhar por queda de sistema, tenta de novo 3 vezes
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: true, // Limpa o Redis para não encher a memória
    removeOnFail: 100, // Guarda log dos últimos 100 erros
  },
});