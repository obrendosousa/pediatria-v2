// Tipos do sistema de senhas/fila (guichê + consultório)

export type ServicePointType = 'guiche' | 'consultorio';
export type ServicePointStatus = 'active' | 'inactive';

export interface ServicePoint {
  id: number;
  name: string;
  code: string;
  type: ServicePointType;
  status: ServicePointStatus;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export type TicketType = 'guiche' | 'consultorio' | 'priority' | 'laboratorio';
export type QueueStage = 'reception' | 'doctor';
export type TicketStatus = 'waiting' | 'called' | 'in_service' | 'completed' | 'cancelled';

/** Categorias do totem de senhas (kiosk) */
export type KioskCategory = 'normal' | 'prioridade' | 'laboratorio' | 'laboratorio_prioridade';

export interface QueueTicket {
  id: number;
  appointment_id: number | null;
  patient_id?: number | null;
  patient_name?: string | null;
  ticket_number: string;
  ticket_type: TicketType;
  queue_stage: QueueStage;
  service_point_id: number | null;
  status: TicketStatus;
  is_priority: boolean;
  called_at: string | null;
  served_at: string | null;
  completed_at: string | null;
  tts_audio_url: string | null;
  created_at: string;
  ticket_date: string;
  kiosk_category?: KioskCategory;
}

/** Ticket enriquecido com dados de join para exibição */
export interface QueueTicketWithDetails extends QueueTicket {
  appointment?: {
    id: number;
    doctor_id?: number | null;
    date?: string;
    time?: string | null;
    patient_id?: number | null;
    patients?: { full_name?: string; phone?: string } | null;
  };
  service_point?: ServicePoint | null;
}

/** Payload enviado via broadcast Realtime para a TV */
export interface TVCallPayload {
  ticket_number: string;
  patient_name: string;
  service_point_name: string;
  service_point_code: string;
  doctor_name?: string;
  is_priority: boolean;
  tts_audio_url?: string;
  /** Texto exato para o browser falar via Web Speech API quando não há tts_audio_url */
  spoken_text?: string;
}
