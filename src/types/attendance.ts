// Tipos para o sistema de navegação de atendimento (estilo iClinic)

export type AttendanceTabKey =
  | 'overview'
  | 'routine'
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
  | 'images'
  | 'allergies'
  | 'evolutions'
  | 'certificates'
  | 'reports'
  | 'gallery'
  | 'anamneses-list';

export interface AttendanceScreenProps {
  patientId: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patientData: any;
  onRefresh?: () => void;
  appointmentId?: number | null;
  medicalRecordId?: number | null;
}

export interface AttendanceMenuItem {
  key: AttendanceTabKey;
  label: string;
  icon?: string; // Nome do ícone do lucide-react (opcional)
}
