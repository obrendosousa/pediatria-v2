'use client';

import React from 'react';
import { 
  Square, Clock, 
  LayoutDashboard, FileText, Stethoscope, 
  Activity, User, ClipboardList, 
  Heart, Pill, UtensilsCrossed, 
  History, RotateCcw, AlertCircle, 
  Microscope, FileCheck, FileImage, Image
} from 'lucide-react';
import { AttendanceTabKey, AttendanceMenuItem } from '@/types/attendance';

interface AttendanceSidebarProps {
  activeTab: AttendanceTabKey;
  onTabChange: (tab: AttendanceTabKey) => void;
  isConsultationActive: boolean;
  consultationDuration: number; // em segundos
  onFinishConsultation: () => void;
}

const MENU_ITEMS: AttendanceMenuItem[] = [
  { key: 'overview', label: 'Atendimento (Visão Geral)', icon: 'LayoutDashboard' },
  { key: 'routine', label: 'Consulta de Rotina', icon: 'FileText' },
  { key: 'physical-exam', label: 'Exame Físico', icon: 'Stethoscope' },
  { key: 'vitals', label: 'Estatura / Peso / IMC / PC', icon: 'Activity' },
  { key: 'adolescent', label: 'Consulta Adolescente', icon: 'User' },
  { key: 'exam-results', label: 'Resultado de Exames', icon: 'ClipboardList' },
  { key: 'diagnostic-hypothesis', label: 'Hipótese Diagnóstica', icon: 'Heart' },
  { key: 'conducts', label: 'Condutas', icon: 'Pill' },
  { key: 'food-history', label: 'Histórico Alimentar', icon: 'UtensilsCrossed' },
  { key: 'first-consultation', label: 'Anamnese da 1ª Consulta', icon: 'History' },
  { key: 'follow-up', label: 'Retorno', icon: 'RotateCcw' },
  { key: 'emergency', label: 'Consulta de Emergência', icon: 'AlertCircle' },
  { key: 'exams-procedures', label: 'Exames e Procedimentos', icon: 'Microscope' },
  { key: 'prescriptions', label: 'Prescrições', icon: 'FileCheck' },
  { key: 'documents', label: 'Documentos e Atestados', icon: 'FileImage' },
  { key: 'images', label: 'Imagens e Anexos', icon: 'Image' },
];

const iconMap: Record<string, React.ElementType> = {
  LayoutDashboard,
  FileText,
  Stethoscope,
  Activity,
  User,
  ClipboardList,
  Heart,
  Pill,
  UtensilsCrossed,
  History,
  RotateCcw,
  AlertCircle,
  Microscope,
  FileCheck,
  FileImage,
  Image,
};

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export function AttendanceSidebar({
  activeTab,
  onTabChange,
  isConsultationActive,
  consultationDuration,
  onFinishConsultation
}: AttendanceSidebarProps) {
  return (
    <div className="w-64 shrink-0 bg-white dark:bg-[#1e2028] border-r border-slate-200 dark:border-gray-800 flex flex-col h-full">
      
      {/* Header com Botão Finalizar e Timer */}
      <div className="p-4 border-b border-slate-200 dark:border-gray-800 space-y-3">
        {isConsultationActive && (
          <>
            <button
              onClick={onFinishConsultation}
              className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Square className="w-4 h-4 fill-current" />
              Finalizar atendimento
            </button>
            
            <div className="flex flex-col items-center py-2">
              <span className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider mb-1">
                Duração
              </span>
              <div className="text-xl font-black font-mono text-slate-700 dark:text-gray-200">
                {formatTime(consultationDuration)}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Lista de Itens do Menu */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-2 space-y-1">
          {MENU_ITEMS.map((item) => {
            const Icon = iconMap[item.icon || 'FileText'];
            const isActive = activeTab === item.key;
            
            return (
              <button
                key={item.key}
                onClick={() => onTabChange(item.key)}
                className={`
                  w-full text-left px-3 py-2.5 rounded-lg transition-all duration-200
                  flex items-center gap-3
                  ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                      : 'text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-[#2a2d36] hover:text-slate-800 dark:hover:text-gray-200'
                  }
                `}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-600 dark:text-blue-400' : ''}`} />
                <span className="text-sm truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
