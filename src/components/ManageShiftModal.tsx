'use client';

import { useState, useEffect } from 'react';
import { 
  X, Calendar, Clock, User, FileText, 
  Ban, CheckCircle2, AlertCircle, Save 
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface ManageShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialDate?: Date; // Opcional: se já quiser abrir numa data específica
}

export default function ManageShiftModal({ isOpen, onClose, onSuccess, initialDate }: ManageShiftModalProps) {
  const [loading, setLoading] = useState(false);
  const [doctors, setDoctors] = useState<any[]>([]);
  
  // Estados do Formulário
  const [doctorId, setDoctorId] = useState<string>('');
  const [type, setType] = useState<'block' | 'available'>('block'); // 'block' = Bloquear, 'available' = Liberar
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('18:00');
  const [reason, setReason] = useState('');

  // Carregar médicos ao abrir
  useEffect(() => {
    if (isOpen) {
      fetchDoctors();
      if (initialDate) {
        setDate(initialDate.toISOString().split('T')[0]);
      }
    }
  }, [isOpen, initialDate]);

  const fetchDoctors = async () => {
    const { data } = await supabase.from('doctors').select('id, name').eq('active', true);
    if (data) {
        setDoctors(data);
        if (data.length > 0 && !doctorId) setDoctorId(data[0].id);
    }
  };

  const handleSave = async () => {
    if (!doctorId || !date || !startTime || !endTime) {
      alert("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    setLoading(true);
    try {
      const isAvailable = type === 'available'; // Se type for 'available', is_available = true

      const payload = {
        doctor_id: parseInt(doctorId),
        override_date: date,
        start_time: startTime,
        end_time: endTime,
        is_available: isAvailable, // true = hora extra/liberado, false = bloqueio
        reason: reason || (isAvailable ? 'Horário Extra' : 'Bloqueio de Agenda')
      };

      const { error } = await supabase.from('schedule_overrides').insert(payload);

      if (error) throw error;

      onSuccess();
      onClose();
      // Reset básico
      setReason('');
    } catch (error) {
      console.error('Erro ao salvar escala:', error);
      alert('Erro ao salvar alteração de escala.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* === HEADER === */}
        <div className="bg-white px-6 py-5 border-b border-slate-100 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Gerenciar Escala</h2>
            <p className="text-xs text-slate-400 font-medium">Configure ausências ou horários extras.</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* === BODY === */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
          
          {/* 1. Seleção de Médico */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <User size={14} /> Profissional
            </label>
            <div className="relative">
              <select
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none"
              >
                {doctors.map(doc => (
                  <option key={doc.id} value={doc.id}>{doc.name}</option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <AlertCircle size={16} />
              </div>
            </div>
          </div>

          {/* 2. Tipo de Ação (Visual Toggle) */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">O que deseja fazer?</label>
            <div className="grid grid-cols-2 gap-3">
                {/* Card Bloquear */}
                <button
                    onClick={() => setType('block')}
                    className={`relative p-4 rounded-2xl border-2 text-left transition-all duration-200 flex flex-col gap-2 ${
                        type === 'block' 
                        ? 'border-rose-500 bg-rose-50/50 ring-1 ring-rose-500' 
                        : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50'
                    }`}
                >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${type === 'block' ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        <Ban size={16} />
                    </div>
                    <div>
                        <span className={`block font-bold text-sm ${type === 'block' ? 'text-rose-700' : 'text-slate-600'}`}>Bloquear Agenda</span>
                        <span className="text-[10px] text-slate-400 font-medium leading-tight">Médico não atenderá (Férias, Folga, etc)</span>
                    </div>
                    {type === 'block' && <div className="absolute top-3 right-3 w-3 h-3 bg-rose-500 rounded-full animate-pulse" />}
                </button>

                {/* Card Liberar */}
                <button
                    onClick={() => setType('available')}
                    className={`relative p-4 rounded-2xl border-2 text-left transition-all duration-200 flex flex-col gap-2 ${
                        type === 'available' 
                        ? 'border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500' 
                        : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50'
                    }`}
                >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${type === 'available' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        <CheckCircle2 size={16} />
                    </div>
                    <div>
                        <span className={`block font-bold text-sm ${type === 'available' ? 'text-emerald-700' : 'text-slate-600'}`}>Liberar Horário</span>
                        <span className="text-[10px] text-slate-400 font-medium leading-tight">Adicionar turno extra ou específico</span>
                    </div>
                    {type === 'available' && <div className="absolute top-3 right-3 w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />}
                </button>
            </div>
          </div>

          {/* 3. Data e Horários */}
          <div className="grid grid-cols-2 gap-4">
             <div className="col-span-2 space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar size={14} /> Data
                </label>
                <input 
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-bold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
             </div>
             
             <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock size={14} /> Início
                </label>
                <input 
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-center"
                />
             </div>

             <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock size={14} /> Fim
                </label>
                <input 
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-center"
                />
             </div>
          </div>

          {/* 4. Motivo */}
          <div className="space-y-2">
             <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <FileText size={14} /> Motivo / Observação
             </label>
             <textarea 
                rows={2}
                placeholder={type === 'block' ? "Ex: Férias, Congresso, Consulta Médica..." : "Ex: Plantão extra, Cobertura..."}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none placeholder:text-slate-400"
             />
          </div>

        </div>

        {/* === FOOTER === */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3">
           <button 
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-3.5 px-6 rounded-xl font-bold text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-all disabled:opacity-50"
           >
              Cancelar
           </button>
           
           <button 
              onClick={handleSave}
              disabled={loading}
              className={`flex-[2] py-3.5 px-6 rounded-xl font-bold text-white shadow-lg shadow-slate-200 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70 disabled:active:scale-100 ${
                  type === 'block' 
                  ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-200' 
                  : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200'
              }`}
           >
              {loading ? (
                <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
              ) : (
                <>
                  <Save size={18} />
                  {type === 'block' ? 'Confirmar Bloqueio' : 'Salvar Disponibilidade'}
                </>
              )}
           </button>
        </div>

      </div>
    </div>
  );
}