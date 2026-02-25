// src/types/index.ts

export interface Message {
  id: number | string;
  chat_id: number | string;
  phone?: string; 
  sender: 'CUSTOMER' | 'AI_AGENT' | 'HUMAN_AGENT' | 'me' | string;
  message_text: string;     
  // Expandido para suportar todos os tipos do preview
  message_type: 'text' | 'image' | 'audio' | 'video' | 'sticker' | 'document' | 'revoked' | string;
  media_url?: string;
  created_at: string;
  wpp_id?: string;
  /** Status de confirmação: sent | delivered | read (apenas para mensagens enviadas) */
  status?: 'sent' | 'delivered' | 'read';
  quoted_wpp_id?: string | null;
  is_edited?: boolean;
  edited_at?: string | null;
  active?: boolean;
  nomewpp?: string;
  bot_message?: string;
  user_message?: string;
  auto_sent_pause_session?: string | null; // UUID da sessão de pausa que enviou esta mensagem

  reactions?: Array<{
    emoji: string;
    sender_phone?: string | null;
    sender_name?: string | null;
    from_me?: boolean;
    created_at?: string;
  }>;
  
  // Campo para Automação Visual
  tool_data?: {
    steps?: Array<{
      label: string;
      status: 'pending' | 'processing' | 'completed' | 'failed';
    }>;
    /** Indica se a mensagem foi encaminhada no WhatsApp (recebida) */
    forwarded?: boolean;
    // Metadados de mídia (duração de áudio, nome de arquivo, etc)
    duration?: number;
    caption?: string;
    fileName?: string;
    reply_to?: {
      wpp_id?: string;
      sender?: string;
      message_type?: string;
      message_text?: string;
      remote_jid?: string;
    };
    is_edited?: boolean;
    edited_at?: string;
    reactions?: Array<{
      emoji: string;
      sender_phone?: string | null;
      sender_name?: string | null;
      from_me?: boolean;
      created_at?: string;
    }>;
    [key: string]: any;
  };
}

export interface Chat {
  id: number;
  phone: string;
  contact_name?: string;    
  profile_pic?: string; // Avatar do contato
  
  // Dados básicos de mensagem
  last_message?: string;
  last_interaction_at?: string;
  
  // Status do sistema
  status: 'ACTIVE' | 'AWAITING_HUMAN' | 'ENDED' | string;
  is_ai_paused?: boolean;
  
  // Pausa de atendimento
  pause_auto_message?: string | null;
  pause_session_id?: string | null;
  pause_started_at?: string | null;
  
  // Organização (CRM)
  stage?: 'new' | 'em_triagem' | 'agendando' | 'fila_espera' | 'screening' | 'scheduling' | 'done' | string;
  priority?: 'low' | 'normal' | 'high';
  tags?: string[];
  
  // IA
  ai_summary?: string; 
  ai_sentiment?: 'neutral' | 'positive' | 'negative';
  
  // --- CAMPOS DO AGENTE AUTÔNOMO E COPILOTO ---
  ai_draft_reply?: string | null;
  ai_draft_reason?: string | null;
  ai_draft_schedule_text?: string | null;
  ai_draft_schedule_date?: string | null;
  ai_draft_schedule_reason?: string | null;
  
  // Recepção
  reception_status?: 'waiting' | 'called' | 'in_service' | 'finished' | string;
  appointment_date?: string;
  appointment_time?: string;
  queue_order?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  
  // Relacionamento com Paciente
  patient_id?: number | null; // ID do paciente vinculado

  // --- NOVOS CAMPOS PARA BARRA LATERAL (WHATSAPP STYLE) ---
  unread_count?: number;
  is_pinned?: boolean;
  is_archived?: boolean;
  is_blocked?: boolean;
  is_muted?: boolean;

  // Preview avançado da última mensagem
  last_message_type?: 'text' | 'image' | 'video' | 'audio' | 'sticker' | 'document';
  last_message_sender?: string; // 'me', 'contact' ou telefone
  last_message_status?: 'sent' | 'delivered' | 'read';
  last_message_data?: {
    duration?: number;
    caption?: string;
    fileName?: string;
    [key: string]: any;
  };

  [key: string]: any; 
}

export interface Patient {
  id: number;
  chat_id: number;
  name: string;
  birth_date?: string;
  notes?: string;
  created_at?: string;
  stage?: string; 
  chats?: Chat;   
}

// --- TIPOS DE PRODUTO E ESTOQUE ---

export interface ProductBatch {
  id: number;
  product_id: number;
  batch_number: string;
  expiration_date: string;
  quantity: number;
}

export interface Product {
  id: number;
  name: string;
  description?: string;
  price_cost: number;
  price_sale: number;
  stock: number;
  category?: string;
  image_url?: string;
  active: boolean;
  batches?: ProductBatch[];
}

export interface Sale {
  id: number;
  chat_id: number | null;
  patient_id?: number | null;
  appointment_id?: number | null;
  total: number;
  status: 'pending' | 'paid' | 'completed' | 'cancelled';
  payment_method?: string;
  origin?: 'atendimento' | 'loja' | string;
  created_by?: string | null;
  created_at: string;
}

export interface SaleItem {
  id: number;
  sale_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  products?: Product;
}

export interface Task {
  id: number;
  chat_id: number;
  type: 'scheduling' | 'followup' | 'sale';
  description: string;
  due_date: string;
  status: 'pending' | 'done';
  created_at: string;
  chats?: Chat;
}

export interface Doctor {
  id: number;
  name: string;
  specialty: string;
  color: string;
  active: boolean;
}

export interface ScheduleRule {
  id: number;
  doctor_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration: number;
}

export interface CheckoutItem {
  id?: number;
  product_id: number;
  quantity: number;
  type: 'product' | 'service';
  products?: Product; 
}

export interface MedicalCheckout {
  id: number;
  chat_id: number;
  patient_id?: number;
  appointment_id?: number;
  doctor_id?: number;
  consultation_value?: number;
  return_date?: string;
  return_obs?: string;
  secretary_notes?: string;
  status: 'pending' | 'completed';
  created_at: string;
  items?: CheckoutItem[];
  chats?: Chat; 
}

// --- NOVOS TIPOS: AUTOMAÇÃO ZAPVOICE ---

export interface Macro {
  id: number;
  title: string;
  type: 'text' | 'audio' | 'image' | 'video' | 'document';
  content: string; // URL se for mídia, Texto se for mensagem
  category?: string;
  is_script?: boolean; // Se true, não envia, apenas mostra para leitura
  simulation_delay?: number;
  created_at?: string;
}

export interface FunnelStep {
  type: 'text' | 'audio' | 'image' | 'video' | 'document' | 'wait' | 'funnel';
  content?: string;
  delay?: number; // Tempo de espera em milissegundos
  title?: string;
  funnel_id?: number;
  funnel_steps?: Array<{
    type: 'text' | 'audio' | 'image' | 'video' | 'document' | 'wait';
    content?: string;
    delay?: number;
  }>;
}

export interface Funnel {
  id: number;
  title: string;
  steps: FunnelStep[]; // JSONB do banco vira objeto aqui
  active: boolean;
  created_at?: string;
}

// --- NOVO TIPO: AGENDAMENTO ---
export interface ScheduledMessage {
  id: number;
  chat_id: number;
  item_type: 'macro' | 'funnel' | 'adhoc';
  item_id?: number;
  title?: string;     // Para exibir na lista
  content: any;       // O conteúdo da macro ou funil salvo
  scheduled_for: string;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';
  created_at: string;
  automation_rule_id?: number; // Para rastrear automações
}

// --- TIPOS DE AUTOMAÇÃO ---
export type AutomationType = 'milestone' | 'appointment_reminder' | 'return_reminder';

export type AutomationMessageType = 'text' | 'audio' | 'image' | 'document';

export interface AutomationMessage {
  type: AutomationMessageType;
  content: string; // Texto ou URL da mídia
  delay?: number; // Delay em segundos antes de enviar (opcional)
  caption?: string; // Para imagens/documentos
}

export interface AutomationRule {
  id: number;
  name: string;
  type: AutomationType;
  active: boolean;
  age_months?: number; // Para tipo 'milestone'
  trigger_time: string; // Formato HH:MM:SS
  message_sequence: AutomationMessage[]; // Array de mensagens
  variables_template?: Record<string, any>; // Template com variáveis
  created_at: string;
  updated_at: string;
}

export type AutomationLogStatus = 'pending' | 'sent' | 'failed';

export interface AutomationLog {
  id: number;
  automation_rule_id: number;
  patient_id: number;
  appointment_id?: number;
  status: AutomationLogStatus;
  sent_at?: string;
  error_message?: string;
  created_at: string;
}

export interface AutomationSentHistory {
  id: number;
  automation_rule_id: number;
  patient_id: number;
  milestone_age?: number; // Para rastrear qual marco foi enviado
  sent_at: string;
}