// src/components/medical-record/AttendanceDetailModal.tsx

import React from 'react';
import { X, User, Calendar, FileText, Activity, Clipboard } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MedicalRecord } from '@/types/medical';

interface AttendanceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: MedicalRecord | null;
  doctorName?: string;
}

export function AttendanceDetailModal({ 
  isOpen, 
  onClose, 
  record,
  doctorName 
}: AttendanceDetailModalProps) {
  
  if (!isOpen || !record) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#1e2028] w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-gray-800 bg-gradient-to-r from-rose-50 to-pink-50 dark:from-[#2a2d36] dark:to-[#2a2d36]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center">
              <FileText className="w-6 h-6 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-gray-100">
                Detalhes do Atendimento
              </h2>
              <p className="text-sm text-slate-500 dark:text-gray-400 flex items-center gap-2 mt-1">
                <Calendar className="w-4 h-4" />
                {format(parseISO(record.created_at), "EEEE, d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/50 dark:hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Body - Scrollable */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <div className="space-y-6">
            
            {/* Informações do Profissional */}
            <div className="bg-slate-50 dark:bg-[#2a2d36] rounded-xl p-4 border border-slate-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-gray-400 font-medium uppercase">Profissional</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-gray-100">
                    Dr(a). {doctorName || 'Não informado'}
                  </p>
                </div>
                <div className="ml-auto">
                  {record.status === 'signed' ? (
                    <span className="text-xs bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800 font-medium">
                      ✓ Assinado
                    </span>
                  ) : (
                    <span className="text-xs bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-3 py-1 rounded-full border border-amber-200 dark:border-amber-800 font-medium">
                      Rascunho
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Sinais Vitais */}
            {record.vitals && (record.vitals.weight || record.vitals.height || record.vitals.imc) && (
              <div>
                <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-rose-500" />
                  Cálculo IMC
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  {record.vitals.weight && (
                    <div className="bg-white dark:bg-[#2a2d36] border border-slate-200 dark:border-gray-700 rounded-xl p-4 text-center">
                      <p className="text-xs text-slate-500 dark:text-gray-400 mb-1">Peso</p>
                      <p className="text-2xl font-bold text-slate-800 dark:text-gray-100">
                        {record.vitals.weight} <span className="text-sm text-slate-500">kg</span>
                      </p>
                    </div>
                  )}
                  {record.vitals.height && (
                    <div className="bg-white dark:bg-[#2a2d36] border border-slate-200 dark:border-gray-700 rounded-xl p-4 text-center">
                      <p className="text-xs text-slate-500 dark:text-gray-400 mb-1">Altura</p>
                      <p className="text-2xl font-bold text-slate-800 dark:text-gray-100">
                        {(record.vitals.height / 100).toFixed(2).replace('.', ',')} <span className="text-sm text-slate-500">m</span>
                      </p>
                    </div>
                  )}
                  {record.vitals.imc && (
                    <div className={`rounded-xl p-4 text-center border ${
                      record.vitals.imc > 25 
                        ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' 
                        : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                    }`}>
                      <p className={`text-xs mb-1 ${
                        record.vitals.imc > 25 
                          ? 'text-amber-600 dark:text-amber-400' 
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        IMC
                      </p>
                      <p className={`text-2xl font-bold ${
                        record.vitals.imc > 25 
                          ? 'text-amber-700 dark:text-amber-300' 
                          : 'text-emerald-700 dark:text-emerald-300'
                      }`}>
                        {record.vitals.imc.toFixed(2).replace('.', ',')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Atendimento */}
            <div>
              <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 mb-3">Atendimento</h3>
              <div className="space-y-4">
                {record.chief_complaint && (
                  <div className="bg-white dark:bg-[#2a2d36] border border-slate-200 dark:border-gray-700 rounded-xl p-4">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-2">Queixa principal:</p>
                    <p className="text-sm text-slate-700 dark:text-gray-200">{record.chief_complaint}</p>
                  </div>
                )}

                {record.hda && (
                  <div className="bg-white dark:bg-[#2a2d36] border border-slate-200 dark:border-gray-700 rounded-xl p-4">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-2">História da moléstia atual:</p>
                    <div 
                      className="text-sm text-slate-700 dark:text-gray-200 prose dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: record.hda }}
                    />
                  </div>
                )}

                {record.antecedents && (
                  <div className="bg-white dark:bg-[#2a2d36] border border-slate-200 dark:border-gray-700 rounded-xl p-4">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-2">Histórico e antecedentes:</p>
                    <div 
                      className="text-sm text-slate-700 dark:text-gray-200 prose dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: record.antecedents }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Exame Físico */}
            {record.physical_exam && (
              <div>
                <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 mb-3">Exame físico</h3>
                <div className="bg-white dark:bg-[#2a2d36] border border-slate-200 dark:border-gray-700 rounded-xl p-4">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-2">Exame físico:</p>
                  <div
                    className="text-sm text-slate-700 dark:text-gray-200 prose dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: record.physical_exam }}
                  />
                </div>
              </div>
            )}

            {/* Diagnóstico */}
            {record.diagnosis && (
              <div>
                <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 mb-3">Diagnóstico</h3>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-200 flex items-center gap-2">
                    <Clipboard className="w-4 h-4" />
                    {record.diagnosis}
                  </p>
                </div>
              </div>
            )}

            {/* Condutas */}
            {record.conducts && (
              <div>
                <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 mb-3">Condutas</h3>
                <div className="bg-white dark:bg-[#2a2d36] border border-slate-200 dark:border-gray-700 rounded-xl p-4">
                  <div 
                    className="text-sm text-slate-700 dark:text-gray-200 prose dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: record.conducts }}
                  />
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-[#2a2d36] flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-white dark:bg-[#1e2028] border border-slate-200 dark:border-gray-700 text-slate-700 dark:text-gray-200 font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-[#2a2d36] transition-colors"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
