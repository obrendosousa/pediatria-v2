import { BaseMessage } from "@langchain/core/messages";

export interface EvolutionWebhookData {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  pushName?: string;
  messageType: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  message: any;
  messageTimestamp: number | string;
  /** Base64 da mídia quando enviado no nível do body (ex: data.base64) */
  base64?: string;
}

export interface IngestionState {
  raw_input: EvolutionWebhookData;
  chat_id?: number;
  phone: string;
  contact_name: string;
  message_content: string;
  message_type: "text" | "audio" | "image" | "video" | "sticker" | "document";
  media_url?: string;
  is_ai_paused: boolean;
  should_continue: boolean;
}

// Mantém referência explícita ao tipo importado para futuras extensões de estado.
export type IngestionMessage = BaseMessage;
