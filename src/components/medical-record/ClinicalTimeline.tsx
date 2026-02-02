// src/components/medical-record/ClinicalTimeline.tsx

import React, { useEffect, useState } from 'react';
import { 
  Calendar, User, FileText, Activity, 
  ChevronRight, Clock, Stethoscope, AlertCircle 
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { MedicalRecord } from '@/types/medical';
import { AttendanceDetailModal } from './AttendanceDetailModal';

interface ClinicalTimelineProps {
  patientId: number;
  refreshTrigger: number; // Incrementa para forçar recarga
}

export function ClinicalTimeline({ patientId, refreshTrigger }: ClinicalTimelineProps) {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null);
  const [selectedDoctorName, setSelectedDoctorName] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchRecords();
  }, [patientId, refreshTrigger]);

  const fetchRecords = async () => {
    setLoading(true);
    // Busca registros e junta com dados do médico (se houver relacionamento)
    const { data, error } = await supabase
      .from('medical_records')
      .select(`
        *,
        doctors:doctor_id ( name ) 
      `)
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setRecords(data as any);
    }
    setLoading(false);
  };

  const handleRecordClick = (record: MedicalRecord) => {
    setSelectedRecord(record);
    setSelectedDoctorName((record as any).doctors?.name || 'Não informado');
    setIsModalOpen(true);
  };

  // Helper para agrupar por Ano
  const groupedRecords = records.reduce((groups, record) => {
    const year = new Date(record.created_at).getFullYear();
    if (!groups[year]) groups[year] = [];
    groups[year].push(record);
    return groups;
  }, {} as Record<number, MedicalRecord[]>);

  const years = Object.keys(groupedRecords).sort((a, b) => Number(b) - Number(a));

  if (loading) return (
    <div className="py-10 flex justify-center">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-rose-500 rounded-full animate-spin"/>
    </div>
  );

  if (records.length === 0) return (
    <div className="text-center py-16 bg-slate-50 dark:bg-[#1e2028]/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-gray-800">
      <div className="w-16 h-16 bg-slate-100 dark:bg-[#2a2d36] rounded-full flex items-center justify-center mx-auto mb-4">
        <Stethoscope className="w-8 h-8 text-slate-400" />
      </div>
      <h3 className="text-slate-900 dark:text-gray-100 font-bold mb-1">Nenhum atendimento registrado</h3>
      <p className="text-slate-500 dark:text-gray-500 text-sm">O histórico clínico aparecerá aqui.</p>
    </div>
  );

  return (
    <>
      <div className="space-y-12 relative">
        {years.map(year => (
          <div key={year} className="relative">
            
            <div className="space-y-8 relative">
              {/* Linha vertical contínua conectando os cards */}
              <div className="absolute left-[18px] top-0 bottom-0 w-[2px] bg-gradient-to-b from-rose-200 via-slate-200 to-slate-100 dark:from-rose-900/30 dark:via-gray-700 dark:to-gray-800" />
              
              {/* Badge do Ano - FIXO na linha (sem sticky, posição absoluta) */}
              <div className="absolute left-0 top-0 z-30 pointer-events-none">
                <div className="flex flex-col items-center pointer-events-auto">
                  <div className="bg-gradient-to-br from-rose-600 to-rose-700 dark:from-rose-500 dark:to-rose-600 text-white text-center rounded-xl px-4 py-2 shadow-xl border-[3px] border-white dark:border-[#0b141a]">
                    <div className="text-base font-bold leading-none tracking-wide">
                      {year}
                    </div>
                  </div>
                </div>
              </div>
              
              {groupedRecords[Number(year)].map((record, index) => (
                <div key={record.id} className={`group relative pl-16 ${index === 0 ? 'pt-20' : ''}`}>
                
                {/* Ícone da Timeline - z-index MAIOR que o badge do ano */}
                <div className={`absolute left-0 flex flex-col items-center z-40 ${index === 0 ? 'top-20' : 'top-6'}`}>
                  {/* Badge com Dia e Mês */}
                  <div className="bg-gradient-to-br from-slate-800 to-slate-700 dark:from-white dark:to-gray-50 text-white dark:text-slate-900 text-center rounded-xl px-3 py-2 mb-2 shadow-lg border-[3px] border-white dark:border-[#0b141a]">
                    <div className="text-lg font-bold leading-none">
                      {format(parseISO(record.created_at), "d", { locale: ptBR })}
                    </div>
                    <div className="text-[10px] uppercase leading-none mt-1 font-semibold tracking-wide">
                      {format(parseISO(record.created_at), "MMM", { locale: ptBR })}
                    </div>
                  </div>
                  
                  {/* Ícone de Status conectado à linha */}
                  <div className={`relative w-9 h-9 rounded-full border-[3px] border-white dark:border-[#0b141a] shadow-lg flex items-center justify-center transition-all duration-200 group-hover:scale-110 ${
                    record.status === 'signed' 
                      ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white' 
                      : 'bg-gradient-to-br from-amber-400 to-amber-600 text-white'
                  }`}>
                    {record.status === 'signed' ? <FileText className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                  </div>
                </div>

                {/* Card do Atendimento */}
                <div 
                  onClick={() => handleRecordClick(record)}
                  className="bg-white dark:bg-[#1e2028] rounded-2xl border-2 border-slate-200 dark:border-gray-800 p-6 shadow-md hover:shadow-xl hover:border-rose-300 dark:hover:border-rose-900/40 hover:-translate-y-1 transition-all duration-300 cursor-pointer"
                >
                  
                  {/* Header do Card */}
                  <div className="flex justify-between items-start mb-4 pb-4 border-b border-slate-50 dark:border-gray-800">
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-800 dark:text-gray-100 flex items-center gap-2">
                        Atendimento
                        {record.status === 'draft' && (
                          <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded border border-amber-100 uppercase">Rascunho</span>
                        )}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                        <User className="w-3 h-3" /> Dr(a). {(record as any).doctors?.name || 'Não informado'}
                      </p>
                    </div>
                    
                    {/* Botão Ver Detalhes */}
                    <button className="text-slate-400 hover:text-rose-500 transition-colors">
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Data e Duração */}
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-50 dark:border-gray-800">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Clock className="w-3 h-3" />
                      <span className="font-medium">
                        {format(parseISO(record.created_at), "HH:mm", { locale: ptBR })} 
                      </span>
                      <span className="text-slate-300">•</span>
                      <span>
                        {format(parseISO(record.created_at), "d 'de' MMMM", { locale: ptBR })}
                      </span>
                    </div>
                    
                    {/* Duração da Consulta */}
                    {record.started_at && record.finished_at && (
                      <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-full">
                        <Clock className="w-3 h-3" />
                        <span className="font-medium">
                          {(() => {
                            const start = new Date(record.started_at);
                            const end = new Date(record.finished_at);
                            const diff = Math.floor((end.getTime() - start.getTime()) / 1000 / 60);
                            const hours = Math.floor(diff / 60);
                            const minutes = diff % 60;
                            if (hours > 0) {
                              return `${hours}h ${minutes}min`;
                            }
                            return `${minutes} minutos`;
                          })()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Conteúdo Resumido */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* Coluna 1: Texto Clínico */}
                    <div className="space-y-3">
                      {record.chief_complaint && (
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Queixa Principal</p>
                          <p className="text-sm font-medium text-slate-700 dark:text-gray-300">{record.chief_complaint}</p>
                        </div>
                      )}
                      
                      {record.diagnosis && (
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Diagnóstico / HD</p>
                          <p className="text-sm font-medium text-slate-800 dark:text-gray-200 bg-slate-50 dark:bg-[#2a2d36] p-2 rounded-lg border border-slate-100 dark:border-gray-700 inline-block">
                            {record.diagnosis}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Coluna 2: Vitais e Métricas */}
                    {record.vitals && (record.vitals.weight || record.vitals.imc) && (
                       <div className="bg-slate-50 dark:bg-[#2a2d36] rounded-xl p-3 border border-slate-100 dark:border-gray-700">
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1">
                            <Activity className="w-3 h-3" /> Sinais Vitais
                          </p>
                          <div className="grid grid-cols-3 gap-2 text-center">
                             {record.vitals.weight && (
                               <div className="bg-white dark:bg-[#1e2028] p-2 rounded-lg shadow-sm">
                                  <span className="block text-[10px] text-slate-400">Peso</span>
                                  <span className="font-bold text-slate-700 dark:text-gray-200">{record.vitals.weight} kg</span>
                               </div>
                             )}
                             {record.vitals.height && (
                               <div className="bg-white dark:bg-[#1e2028] p-2 rounded-lg shadow-sm">
                                  <span className="block text-[10px] text-slate-400">Altura</span>
                                  <span className="font-bold text-slate-700 dark:text-gray-200">{record.vitals.height} cm</span>
                               </div>
                             )}
                             {record.vitals.imc && (
                               <div className={`p-2 rounded-lg shadow-sm border ${record.vitals.imc > 25 ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'}`}>
                                  <span className={`block text-[10px] ${record.vitals.imc > 25 ? 'text-amber-600' : 'text-emerald-600'}`}>IMC</span>
                                  <span className={`font-bold ${record.vitals.imc > 25 ? 'text-amber-700' : 'text-emerald-700'}`}>{record.vitals.imc.toFixed(1)}</span>
                               </div>
                             )}
                          </div>
                       </div>
                    )}

                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>

    {/* Modal de Detalhes */}
    <AttendanceDetailModal
      isOpen={isModalOpen}
      onClose={() => setIsModalOpen(false)}
      record={selectedRecord}
      doctorName={selectedDoctorName}
    />
  </>
  );
}