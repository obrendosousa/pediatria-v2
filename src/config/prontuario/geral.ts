// Config do prontuário do módulo GERAL (Sistema Geral da Clínica)
// Baseado no PRD do Support Clinic — 16 telas

import {
  History, NotebookPen, ShieldAlert, TrendingUp, FileCheck,
  Pill, Award, ScrollText, Microscope, ClipboardList,
  Target, Paperclip, UtensilsCrossed, BookMarked, Camera, FileImage,
  ExternalLink,
} from 'lucide-react';
import type { ProntuarioModuleConfig } from '@/types/prontuario';

// Telas reutilizadas do sistema existente
import { ProntuarioAnamnese } from '@/components/medical-record/prontuario/screens/ProntuarioAnamnese';
import { EvolutionsList } from '@/components/medical-record/screens/EvolutionsList';
import { CertificatesList } from '@/components/medical-record/screens/CertificatesList';
import { ReportsList } from '@/components/medical-record/screens/ReportsList';
import { Prescriptions } from '@/components/medical-record/attendance/screens/Prescriptions';
import { ExamsAndProcedures } from '@/components/medical-record/attendance/screens/ExamsAndProcedures';
import { AttachmentsList } from '@/components/medical-record/attendance/screens/AttachmentsList';
import { ImageGallery } from '@/components/medical-record/attendance/screens/ImageGallery';
import { DocumentsAndCertificates } from '@/components/medical-record/attendance/screens/DocumentsAndCertificates';

// Telas novas do prontuário
import { ProntuarioHistorico } from '@/components/medical-record/prontuario/screens/ProntuarioHistorico';
import { ProntuarioExamResults } from '@/components/medical-record/prontuario/screens/ProntuarioExamResults';
import { AllergyManager } from '@/components/medical-record/prontuario/screens/AllergyManager';
import { TherapeuticPlansList } from '@/components/medical-record/prontuario/screens/TherapeuticPlansList';
import { PatientDietsList } from '@/components/medical-record/prontuario/screens/PatientDietsList';
import { PatientCidsList } from '@/components/medical-record/prontuario/screens/PatientCidsList';
import { MemedPlaceholder } from '@/components/medical-record/prontuario/screens/MemedPlaceholder';
import { SupportLabPlaceholder } from '@/components/medical-record/prontuario/screens/SupportLabPlaceholder';

export const GERAL_PRONTUARIO: ProntuarioModuleConfig = {
  defaultTab: 'historico',

  sidebar: [
    // ─── Histórico ───
    { type: 'item', key: 'historico', label: 'Histórico do Paciente', icon: History },

    // ─── Prontuário ───
    { type: 'section', label: 'Prontuário' },
    { type: 'item', key: 'anamneses', label: 'Anamnese', icon: NotebookPen },
    { type: 'item', key: 'alergias', label: 'Alergias', icon: ShieldAlert },
    { type: 'item', key: 'evolucoes', label: 'Evoluções', icon: TrendingUp },
    { type: 'item', key: 'cids', label: "CID's", icon: BookMarked },
    { type: 'item', key: 'planos', label: 'Planos Terapêuticos', icon: Target },

    // ─── Prescrições ───
    { type: 'section', label: 'Prescrições' },
    { type: 'item', key: 'receitas', label: 'Receitas', icon: FileCheck },
    { type: 'item', key: 'memed', label: 'Memed', icon: Pill },
    { type: 'item', key: 'dietas', label: 'Dietas', icon: UtensilsCrossed },

    // ─── Documentos ───
    { type: 'section', label: 'Documentos' },
    { type: 'item', key: 'atestados', label: 'Atestados', icon: Award },
    { type: 'item', key: 'laudos', label: 'Laudos', icon: ScrollText },
    { type: 'item', key: 'documentos', label: 'Documentos / Termos', icon: FileImage },

    // ─── Exames ───
    { type: 'submenu', label: 'Exames', icon: Microscope, children: [
      { key: 'exames-pedidos', label: 'Pedidos', icon: ClipboardList },
      { key: 'exames-resultados', label: 'Resultados', icon: FileCheck },
      { key: 'support-lab', label: 'Support Lab', icon: ExternalLink },
    ]},

    // ─── Arquivos ───
    { type: 'section', label: 'Arquivos' },
    { type: 'item', key: 'galeria', label: 'Galeria de Imagens', icon: Camera },
    { type: 'item', key: 'anexos', label: 'Anexos', icon: Paperclip },
  ],

   
  screens: {
    'historico': ProntuarioHistorico,
    'anamneses': ProntuarioAnamnese,
    'alergias': AllergyManager,
    'evolucoes': EvolutionsList,
    'receitas': Prescriptions,
    'memed': MemedPlaceholder,
    'atestados': CertificatesList,
    'laudos': ReportsList,
    'exames-pedidos': ExamsAndProcedures,
    'exames-resultados': ProntuarioExamResults,
    'support-lab': SupportLabPlaceholder,
    'planos': TherapeuticPlansList,
    'anexos': AttachmentsList,
    'dietas': PatientDietsList,
    'cids': PatientCidsList,
    'galeria': ImageGallery,
    'documentos': DocumentsAndCertificates,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any,
};
