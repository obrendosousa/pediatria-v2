import { z } from "zod";

export const CONTRACT_VERSION = "v1";

export const messageTypeSchema = z.enum(["text", "audio", "image", "video", "document", "wait", "revoked"]);
export type MessageType = z.infer<typeof messageTypeSchema>;

export const automationMessageSchema = z.object({
  type: z.enum(["text", "audio", "image", "document"]),
  content: z.string(),
  delay: z.number().int().nonnegative().optional(),
  caption: z.string().optional(),
});
export type AutomationMessageContract = z.infer<typeof automationMessageSchema>;

export const sendCommandSchema = z.object({
  contractVersion: z.literal(CONTRACT_VERSION).default(CONTRACT_VERSION),
  chatId: z.number().int().positive(),
  phone: z.string().min(8),
  type: z.enum(["text", "audio", "image", "video", "document"]).default("text"),
  message: z.string().optional(),
  mediaUrl: z.string().url().optional(),
  dbMessageId: z.number().int().positive().optional(),
  runId: z.string().uuid().optional(),
  threadId: z.string().min(1).optional(),
  replyTo: z
    .object({
      wppId: z.string(),
      sender: z.string().optional(),
      message_type: z.string().optional(),
      quotedText: z.string().optional(),
      remoteJid: z.string().optional(),
      fromMe: z.boolean().optional(),
    })
    .optional(),
});
export type SendCommandContract = z.infer<typeof sendCommandSchema>;

export const webhookEventSchema = z.object({
  contractVersion: z.literal(CONTRACT_VERSION).default(CONTRACT_VERSION),
  event: z.string().optional(),
  payload: z.record(z.string(), z.unknown()),
  receivedAt: z.string().datetime().optional(),
});
export type WebhookEventContract = z.infer<typeof webhookEventSchema>;

export const schedulerRunCommandSchema = z.object({
  contractVersion: z.literal(CONTRACT_VERSION).default(CONTRACT_VERSION),
  triggerAt: z.string().datetime().optional(),
  dryRun: z.boolean().default(false),
  runId: z.string().uuid().optional(),
});
export type SchedulerRunCommandContract = z.infer<typeof schedulerRunCommandSchema>;

export const dispatchRunCommandSchema = z.object({
  contractVersion: z.literal(CONTRACT_VERSION).default(CONTRACT_VERSION),
  nowIso: z.string().datetime().optional(),
  batchSize: z.number().int().positive().max(200).default(25),
  dryRun: z.boolean().default(false),
  runId: z.string().uuid().optional(),
});
export type DispatchRunCommandContract = z.infer<typeof dispatchRunCommandSchema>;

export const funnelRunCommandSchema = z.object({
  contractVersion: z.literal(CONTRACT_VERSION).default(CONTRACT_VERSION),
  chatId: z.number().int().positive(),
  phone: z.string().min(8),
  title: z.string().min(1),
  steps: z.array(
    z.object({
      type: z.enum(["text", "audio", "image", "document", "video", "wait"]),
      content: z.string().optional(),
      delay: z.number().int().nonnegative().optional(),
    })
  ),
  initiatedBy: z.enum(["ui", "api", "system"]).default("ui"),
  runId: z.string().uuid().optional(),
  threadId: z.string().min(1).optional(),
});
export type FunnelRunCommandContract = z.infer<typeof funnelRunCommandSchema>;

export const workerAckSchema = z.object({
  ok: z.boolean(),
  contractVersion: z.literal(CONTRACT_VERSION).default(CONTRACT_VERSION),
  runId: z.string().uuid().optional(),
  threadId: z.string().optional(),
  message: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      retryable: z.boolean().default(false),
    })
    .optional(),
});
export type WorkerAckContract = z.infer<typeof workerAckSchema>;
