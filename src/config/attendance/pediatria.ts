// Config de attendance do módulo PEDIATRIA
// ⚠️  CONGELADO - não modificar sem necessidade. Pediatria já está estável na VPS.

import {
  LayoutDashboard, FileText, Activity, User, ClipboardList,
  Heart, Pill, UtensilsCrossed, History, RotateCcw, AlertCircle,
  Microscope, FileCheck, FileImage, Image,
} from 'lucide-react';
import type { AttendanceModuleConfig } from '@/types/attendance';

// Screens da pediatria (importações lazy)
import { AttendanceOverview } from '@/components/medical-record/attendance/screens/AttendanceOverview';
import { RoutineConsultation } from '@/components/medical-record/attendance/screens/RoutineConsultation';
import { VitalsChart } from '@/components/medical-record/attendance/screens/VitalsChart';
import { AdolescentConsultation } from '@/components/medical-record/attendance/screens/AdolescentConsultation';
import { ExamResults } from '@/components/medical-record/attendance/screens/ExamResults';
import { DiagnosticHypothesis } from '@/components/medical-record/attendance/screens/DiagnosticHypothesis';
import { Conducts } from '@/components/medical-record/attendance/screens/Conducts';
import { FoodHistory } from '@/components/medical-record/attendance/screens/FoodHistory';
import { FirstConsultationAnamnesis } from '@/components/medical-record/attendance/screens/FirstConsultationAnamnesis';
import { FollowUp } from '@/components/medical-record/attendance/screens/FollowUp';
import { EmergencyConsultation } from '@/components/medical-record/attendance/screens/EmergencyConsultation';
import { ExamsAndProcedures } from '@/components/medical-record/attendance/screens/ExamsAndProcedures';
import { Prescriptions } from '@/components/medical-record/attendance/screens/Prescriptions';
import { DocumentsAndCertificates } from '@/components/medical-record/attendance/screens/DocumentsAndCertificates';
import { AttachmentsList } from '@/components/medical-record/attendance/screens/AttachmentsList';

export const PEDIATRIA_ATTENDANCE: AttendanceModuleConfig = {
  defaultTab: 'overview',

  // Sidebar plana — exatamente como na VPS (15 itens, sem seções)
  sidebar: [
    { type: 'item', key: 'overview', label: 'Atendimento (Visão Geral)', icon: LayoutDashboard },
    { type: 'item', key: 'routine', label: 'Consulta de Rotina', icon: FileText },
    { type: 'item', key: 'vitals', label: 'Estatura / Peso / IMC / PC', icon: Activity },
    { type: 'item', key: 'adolescent', label: 'Consulta Adolescente', icon: User },
    { type: 'item', key: 'exam-results', label: 'Resultado de Exames', icon: ClipboardList },
    { type: 'item', key: 'diagnostic-hypothesis', label: 'Hipótese Diagnóstica', icon: Heart },
    { type: 'item', key: 'conducts', label: 'Condutas', icon: Pill },
    { type: 'item', key: 'food-history', label: 'Histórico Alimentar', icon: UtensilsCrossed },
    { type: 'item', key: 'first-consultation', label: 'Anamnese da 1ª Consulta', icon: History },
    { type: 'item', key: 'follow-up', label: 'Retorno', icon: RotateCcw },
    { type: 'item', key: 'emergency', label: 'Consulta de Emergência', icon: AlertCircle },
    { type: 'item', key: 'exams-procedures', label: 'Exames e Procedimentos', icon: Microscope },
    { type: 'item', key: 'prescriptions', label: 'Prescrições', icon: FileCheck },
    { type: 'item', key: 'documents', label: 'Documentos e Atestados', icon: FileImage },
    { type: 'item', key: 'images', label: 'Imagens e Anexos', icon: Image },
  ],

  // Apenas as 15 telas originais
  screens: {
    'overview': AttendanceOverview,
    'routine': RoutineConsultation,
    'vitals': VitalsChart,
    'adolescent': AdolescentConsultation,
    'exam-results': ExamResults,
    'diagnostic-hypothesis': DiagnosticHypothesis,
    'conducts': Conducts,
    'food-history': FoodHistory,
    'first-consultation': FirstConsultationAnamnesis,
    'follow-up': FollowUp,
    'emergency': EmergencyConsultation,
    'exams-procedures': ExamsAndProcedures,
    'prescriptions': Prescriptions,
    'documents': DocumentsAndCertificates,
    'images': AttachmentsList,
  },
};
