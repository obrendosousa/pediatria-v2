'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import { Appointment } from '@/types/medical';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getLocalDateRange, formatAppointmentTime, getTodayDateString } from '@/utils/dateUtils';
import { 
  Clock, MessageCircle, CheckCircle, Play, 
  DollarSign, MapPin, Megaphone, Loader2
} from 'lucide-react';
import QuickChatModal from '@/components/chat/QuickChatModal';
import ReceptionCheckoutModal from '@/components/medical/ReceptionCheckoutModal';
import { useToast } from '@/contexts/ToastContext';

export default function DailyReceptionList() {
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<number | null>(null);
  const [isUpdating, setIsUpdating] = useState<number | null>(null);

  const fetchToday = async () => {
    setLoading(true);
    // Usar função utilitária para garantir timezone correto
    const todayStr = getTodayDateString();
    const { startOfDay, endOfDay } = getLocalDateRange(todayStr);
    
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .gte('start_time', startOfDay)
      .lte('start_time', endOfDay)
      .neq('status', 'cancelled')
      .neq('status', 'blocked')
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Erro ao buscar agendamentos:', error);
    } else {
      setAppointments((data as Appointment[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchToday();
    
    // Realtime para atualizar status
    const channel = supabase
      .channel('reception_view')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'appointments' 
      }, () => {
        fetchToday();
      })
      .subscribe();

    return () => { 
      supabase.removeChannel(channel); 
    };
  }, []);

  const updateStatus = async (id: number, newStatus: string) => {
    setIsUpdating(id);
    try {
      const updatePayload: Record<string, string | null> = { status: newStatus };
      if (newStatus === 'waiting') {
        updatePayload.queue_entered_at = new Date().toISOString();
      } else if (newStatus === 'in_service') {
        updatePayload.in_service_at = new Date().toISOString();
      } else if (newStatus === 'finished' || newStatus === 'waiting_payment') {
        updatePayload.finished_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('appointments')
        .update(updatePayload)
        .eq('id', id);

      if (error) throw error;
      
      // Atualiza localmente para feedback imediato
      setAppointments(prev => 
        prev.map(apt => apt.id === id ? { ...apt, ...updatePayload, status: newStatus as any } : apt)
      );
    } catch (error: any) {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status: ' + (error.message || 'Tente novamente.'));
    } finally {
      setIsUpdating(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'scheduled': 
        return (
          <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1">
            Agendado
          </span>
        );
      case 'waiting': 
        return (
          <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1">
            <CheckCircle size={12}/> Na Espera
          </span>
        );
      case 'in_service': 
        return (
          <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1">
            <Play size={12}/> Em Atendimento
          </span>
        );
      case 'waiting_payment': 
        return (
          <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1">
            <DollarSign size={12}/> Checkout / Pagamento
          </span>
        );
      case 'finished': 
        return (
          <span className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2 py-1 rounded-md text-xs font-bold">
            Finalizado
          </span>
        );
      default: 
        return null;
    }
  };

  // Usar função utilitária para formatação de horário
  const formatTime = formatAppointmentTime;

  const isTimePast = (dateStr: string): boolean => {
    const dateStrClean = dateStr ? dateStr.replace(/[+-]\d{2}:\d{2}$/, '').replace('Z', '') : '';
    const [datePart, timePart] = dateStrClean.split('T');
    if (datePart && timePart) {
      const [year, month, day] = datePart.split('-').map(Number);
      const [hours, minutes] = timePart.split(':').map(Number);
      const appointmentTime = new Date(year, month - 1, day, hours, minutes || 0, 0);
      return appointmentTime < new Date();
    }
    return false;
  };

  const getNextPatient = () => {
    return appointments.find(apt => 
      apt.status === 'scheduled' || apt.status === 'waiting'
    );
  };

  const nextPatient = getNextPatient();

  if (loading) {
    return (
      <div className="p-10 text-center text-gray-400 dark:text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
        Carregando agenda...
      </div>
    );
  }

  return (
    <>
      <div className="bg-white dark:bg-[#1e2028] rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#2a2d36] flex justify-between items-center">
          <h2 className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <Clock className="w-5 h-5 text-pink-600 dark:text-pink-400" />
            Agenda de Hoje ({format(new Date(), "dd 'de' MMMM", { locale: ptBR })})
          </h2>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {appointments.length} {appointments.length === 1 ? 'paciente' : 'pacientes'}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-[#111b21] text-xs uppercase text-gray-400 dark:text-gray-500 font-bold">
              <tr>
                <th className="p-4">Horário</th>
                <th className="p-4">Paciente</th>
                <th className="p-4">Médico</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {appointments.map((apt) => {
                const timeStr = formatTime(apt.start_time);
                const isPast = isTimePast(apt.start_time) && apt.status !== 'finished';
                const isNext = nextPatient?.id === apt.id;
                
                return (
                  <tr 
                    key={apt.id} 
                    className={`hover:bg-gray-50 dark:hover:bg-[#111b21] transition-colors group ${
                      isNext ? 'bg-pink-50/50 dark:bg-pink-900/10 border-l-4 border-l-pink-500' : ''
                    }`}
                  >
                    <td className={`p-4 font-mono text-sm font-bold ${
                      isPast ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-300'
                    }`}>
                      {timeStr}
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-gray-800 dark:text-gray-100">
                        {apt.patient_name || 'Sem nome'}
                      </div>
                      {apt.patient_phone && (
                        <div className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 mt-0.5">
                          <button
                            onClick={() => setSelectedPhone(apt.patient_phone || null)}
                            className="hover:text-pink-600 dark:hover:text-pink-400 transition-colors flex items-center gap-1"
                          >
                            <MessageCircle size={10}/>
                            {apt.patient_phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-sm text-gray-600 dark:text-gray-300">
                      {apt.doctor_name || 'Não informado'}
                    </td>
                    <td className="p-4">
                      {getStatusBadge(apt.status || 'scheduled')}
                    </td>
                    <td className="p-4 text-right">
                      {(!apt.status || apt.status === 'scheduled') && (
                        <button 
                          onClick={() => updateStatus(apt.id, 'waiting')}
                          disabled={isUpdating === apt.id}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isUpdating === apt.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <MapPin size={14} />
                          )}
                          Check-in
                        </button>
                      )}
                      {apt.status === 'waiting' && (
                        <button 
                          onClick={() => updateStatus(apt.id, 'in_service')}
                          disabled={isUpdating === apt.id}
                          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isUpdating === apt.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Megaphone size={14} />
                          )}
                          Chamar
                        </button>
                      )}
                      {apt.status === 'in_service' && (
                        <div className="text-purple-600 dark:text-purple-400 text-xs font-medium flex items-center gap-1 justify-end">
                          <Loader2 size={14} className="animate-spin" />
                          Em andamento...
                        </div>
                      )}
                      
                      {/* Lógica para Checkout ou Ver Pagamento */}
                      {(apt.status === 'waiting_payment' || apt.status === 'finished') && (
                        <button
                          onClick={() => setSelectedAppointmentId(apt.id)}
                          className={`
                            flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ml-auto
                            ${apt.status === 'waiting_payment' 
                              ? 'bg-amber-100 hover:bg-amber-200 text-amber-700 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 dark:text-amber-400 border border-amber-200 dark:border-amber-800' 
                              : 'text-gray-400 hover:text-green-600 dark:hover:text-green-400 border border-transparent hover:border-green-200 dark:hover:border-green-800'
                            }
                          `}
                        >
                          <DollarSign size={14}/>
                          {apt.status === 'waiting_payment' && 'Realizar Checkout'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {appointments.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-gray-400 dark:text-gray-500">
                    Nenhum agendamento para hoje.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modais */}
      {selectedPhone && (
        <QuickChatModal
          isOpen={!!selectedPhone}
          onClose={() => setSelectedPhone(null)}
          patientPhone={selectedPhone}
        />
      )}

      {selectedAppointmentId && (
        <ReceptionCheckoutModal
          isOpen={!!selectedAppointmentId}
          onClose={() => setSelectedAppointmentId(null)}
          appointmentId={selectedAppointmentId}
          onSuccess={() => {
            setSelectedAppointmentId(null);
            fetchToday();
          }}
        />
      )}
    </>
  );
}