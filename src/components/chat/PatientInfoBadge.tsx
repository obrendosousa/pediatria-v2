'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { User, FileText, Calendar, Phone, X, ExternalLink, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import { useRouter } from 'next/navigation';
import { getPatientPhones, getPatientAppointments } from '@/utils/patientRelations';

interface PatientInfoBadgeProps {
  chatId: number;
  patientId: number | null;
  onLinkPatient?: (patientId: number) => void;
}

export function PatientInfoBadge({ chatId, patientId, onLinkPatient }: PatientInfoBadgeProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [patient, setPatient] = useState<any>(null);
  const [phones, setPhones] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (patientId && isOpen) {
      fetchPatientData();
    }
  }, [patientId, isOpen]);

  const fetchPatientData = async () => {
    if (!patientId) return;
    
    setLoading(true);
    try {
      // Buscar dados do paciente
      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single();

      if (patientError) throw patientError;
      setPatient(patientData);

      // Buscar números do paciente
      const phonesData = await getPatientPhones(patientId);
      setPhones(phonesData);

      // Buscar appointments do paciente
      const appointmentsData = await getPatientAppointments(patientId);
      setAppointments(appointmentsData.slice(0, 5)); // Últimos 5
    } catch (error) {
      console.error('Erro ao buscar dados do paciente:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenProntuario = () => {
    if (patientId) {
      router.push(`/clients/${patientId}`);
      setIsOpen(false);
    }
  };

  if (!patientId) {
    return null;
  }

  return (
    <>
      {/* Badge no Header */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg transition-colors text-sm font-semibold"
      >
        <User className="w-4 h-4" />
        <span>Paciente Vinculado</span>
      </button>

      {/* Modal de Informações */}
      {isOpen && mounted && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setIsOpen(false)}
        >
          <div 
            className="bg-white dark:bg-[#202c33] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-gray-800 bg-slate-50/50 dark:bg-[#181a20]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-gray-100">
                    {patient?.name || 'Carregando...'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Informações do Paciente</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
              ) : patient ? (
                <div className="space-y-6">
                  {/* Informações Básicas */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase">Nome</label>
                      <p className="text-sm font-semibold text-slate-800 dark:text-gray-100 mt-1">
                        {patient.name}
                      </p>
                    </div>
                    {patient.birth_date && (
                      <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase">Data de Nascimento</label>
                        <p className="text-sm font-semibold text-slate-800 dark:text-gray-100 mt-1">
                          {new Date(patient.birth_date).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    )}
                    {patient.phone && (
                      <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase">Telefone Principal</label>
                        <p className="text-sm font-semibold text-slate-800 dark:text-gray-100 mt-1">
                          {patient.phone}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Números Vinculados */}
                  {phones.length > 0 && (
                    <div>
                      <label className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase mb-2 block">
                        Números de Contato ({phones.length})
                      </label>
                      <div className="space-y-2">
                        {phones.map((phone) => (
                          <div
                            key={phone.id}
                            className={`p-3 rounded-lg border ${
                              phone.is_primary
                                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Phone className="w-4 h-4 text-slate-400" />
                                <span className="font-medium text-slate-800 dark:text-gray-100">
                                  {phone.phone_formatted || phone.phone}
                                </span>
                                {phone.is_primary && (
                                  <span className="text-[10px] px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                                    Principal
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Appointments Recentes */}
                  {appointments.length > 0 && (
                    <div>
                      <label className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase mb-2 block">
                        Agendamentos Recentes ({appointments.length})
                      </label>
                      <div className="space-y-2">
                        {appointments.map((apt) => (
                          <div
                            key={apt.id}
                            className="p-3 rounded-lg border bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Calendar className="w-4 h-4 text-slate-400" />
                                <div>
                                  <p className="text-sm font-semibold text-slate-800 dark:text-gray-100">
                                    {new Date(apt.start_time).toLocaleDateString('pt-BR')} às {new Date(apt.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                  {apt.doctor_name && (
                                    <p className="text-xs text-slate-500 dark:text-gray-400">
                                      {apt.doctor_name}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <span className={`text-[10px] px-2 py-1 rounded-full font-semibold ${
                                apt.status === 'scheduled' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                apt.status === 'in_service' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
                                apt.status === 'finished' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                                'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                              }`}>
                                {apt.status === 'scheduled' ? 'Agendado' :
                                 apt.status === 'in_service' ? 'Em Atendimento' :
                                 apt.status === 'finished' ? 'Finalizado' :
                                 apt.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500 dark:text-gray-400">
                  Erro ao carregar dados do paciente
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-gray-800 bg-slate-50/50 dark:bg-[#181a20] flex justify-end gap-3">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-slate-600 dark:text-gray-300 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors"
              >
                Fechar
              </button>
              <button
                onClick={handleOpenProntuario}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Abrir Prontuário
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
