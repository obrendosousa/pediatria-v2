// Config de attendance do módulo GERAL (Sistema Geral da Clínica)
// ✅  Pode evoluir livremente sem afetar a pediatria.

import {
  LayoutDashboard, FileText, Activity, User, ClipboardList,
  Heart, Pill, UtensilsCrossed, History, RotateCcw, AlertCircle,
  Microscope, FileCheck, FileImage, Image, ShieldAlert, TrendingUp,
  Award, ScrollText, Camera, NotebookPen,
} from 'lucide-react';
import type { AttendanceModuleConfig } from '@/types/attendance';

// Screens compartilhadas
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
import { ImageGallery } from '@/components/medical-record/attendance/screens/ImageGallery';
import { Allergies } from '@/components/medical-record/attendance/screens/Allergies';
import { EvolutionsList } from '@/components/medical-record/screens/EvolutionsList';
import { CertificatesList } from '@/components/medical-record/screens/CertificatesList';
import { ReportsList } from '@/components/medical-record/screens/ReportsList';
import { AnamnesesList } from '@/components/medical-record/screens/AnamnesesList';

export const GERAL_ATTENDANCE: AttendanceModuleConfig = {
  defaultTab: 'overview',

  // Sidebar com seções — estrutura completa do sistema geral
  sidebar: [
    // ─── Consulta ───
    { type: 'section', label: 'Consulta' },
    { type: 'item', key: 'overview', label: 'Visão Geral', icon: LayoutDashboard },
    { type: 'item', key: 'routine', label: 'Consulta de Rotina', icon: FileText },
    { type: 'item', key: 'first-consultation', label: 'Anamnese', icon: History },
    { type: 'item', key: 'adolescent', label: 'Consulta Adolescente', icon: User },
    { type: 'item', key: 'follow-up', label: 'Retorno', icon: RotateCcw },
    { type: 'item', key: 'emergency', label: 'Emergência', icon: AlertCircle },

    // ─── Prontuário ───
    { type: 'section', label: 'Prontuário' },
    { type: 'item', key: 'vitals', label: 'Estatura / Peso / IMC', icon: Activity },
    { type: 'item', key: 'anamneses-list', label: 'Anamneses', icon: NotebookPen },
    { type: 'item', key: 'allergies', label: 'Alergias', icon: ShieldAlert },
    { type: 'item', key: 'evolutions', label: 'Evoluções', icon: TrendingUp },
    { type: 'item', key: 'diagnostic-hypothesis', label: 'Hipótese Diagnóstica', icon: Heart },
    { type: 'item', key: 'conducts', label: 'Condutas', icon: Pill },
    { type: 'item', key: 'food-history', label: 'Histórico Alimentar', icon: UtensilsCrossed },

    // ─── Documentos ───
    { type: 'section', label: 'Documentos' },
    { type: 'item', key: 'prescriptions', label: 'Receitas', icon: FileCheck },
    { type: 'item', key: 'certificates', label: 'Atestados', icon: Award },
    { type: 'item', key: 'reports', label: 'Laudos', icon: ScrollText },

    // ─── Exames (submenu expansível) ───
    { type: 'submenu', label: 'Exames', icon: Microscope, children: [
      { key: 'exams-procedures', label: 'Pedidos', icon: ClipboardList },
      { key: 'exam-results', label: 'Resultados', icon: FileCheck },
    ]},

    // ─── Arquivos ───
    { type: 'section', label: 'Arquivos' },
    { type: 'item', key: 'documents', label: 'Documentos / Termos', icon: FileImage },
    { type: 'item', key: 'gallery', label: 'Galeria de Imagens', icon: Camera },
    { type: 'item', key: 'images', label: 'Anexos', icon: Image },
  ],

  // Todas as telas (compartilhadas + novas do sistema geral)
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
    'allergies': Allergies,
    'evolutions': EvolutionsList,
    'certificates': CertificatesList,
    'reports': ReportsList,
    'gallery': ImageGallery,
    'anamneses-list': AnamnesesList,
  },
};
