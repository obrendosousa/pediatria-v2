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
  /** Indica se a mensagem foi encaminhada no WhatsApp (contextInfo.forwarded) */
  isForwarded?: boolean;
}

export interface IngestionState {
  raw_input: EvolutionWebhookData;
  chat_id?: number;
  phone: string;
  contact_name: string;
  message_timestamp_iso?: string;
  source_jid?: string;
  resolved_jid?: string;
  resolver_strategy?: "direct" | "lid_lookup" | "lid_resolved" | "lid_unresolved";
  resolver_latency_ms?: number;
  resolver_error?: string;
  message_content: string;
  message_type: "text" | "audio" | "image" | "video" | "sticker" | "document";
  media_url?: string;
  is_ai_paused: boolean;
  should_continue: boolean;
  /** Indica se a mensagem recebida foi encaminhada (para persistir em tool_data) */
  is_forwarded?: boolean;
  /** Dados da mensagem citada/respondida (para exibir preview na UI) */
  quoted_info?: {
    wpp_id: string;
    sender: 'HUMAN_AGENT' | 'CUSTOMER';
    sender_name?: string | null;
    message_type: string;
    message_text: string;
    remote_jid: string;
  } | null;
}

// Mantém referência explícita ao tipo importado para futuras extensões de estado.
export type IngestionMessage = BaseMessage;
