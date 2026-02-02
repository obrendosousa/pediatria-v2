// Tipos para o sistema de navegação de atendimento (estilo iClinic)

export type AttendanceTabKey =
  | 'overview'
  | 'routine'
  | 'physical-exam'
  | 'vitals'
  | 'adolescent'
  | 'exam-results'
  | 'diagnostic-hypothesis'
  | 'conducts'
  | 'food-history'
  | 'first-consultation'
  | 'follow-up'
  | 'emergency'
  | 'exams-procedures'
  | 'prescriptions'
  | 'documents'
  | 'images';

export interface AttendanceScreenProps {
  patientId: number;
  patientData: any;
  onRefresh?: () => void;
  appointmentId?: number | null;
}

export interface AttendanceMenuItem {
  key: AttendanceTabKey;
  label: string;
  icon?: string; // Nome do ícone do lucide-react (opcional)
}
