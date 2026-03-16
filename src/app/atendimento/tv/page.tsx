'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Appointment } from '@/types/medical';
import { getLocalDateRange, getTodayDateString } from '@/utils/dateUtils';
import { Stethoscope, Volume2 } from 'lucide-react';

const supabase = createClient();

/**
 * Painel TV — Exibido na sala de espera para pacientes.
 * Mostra a fila de atendimento e anuncia chamadas com animação.
 * Fullscreen e auto-atualiza via Supabase Realtime.
 */
export default function TVPanelPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [callingPatient, setCallingPatient] = useState<Appointment | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastCalledIds, setLastCalledIds] = useState<Set<number>>(new Set());

  const fetchAppointments = useCallback(async () => {
    const today = getTodayDateString();
    const { startOfDay, endOfDay } = getLocalDateRange(today);

    const { data } = await supabase
      .from('appointments')
      .select('*')
      .gte('start_time', startOfDay)
      .lte('start_time', endOfDay)
      .in('status', ['waiting', 'called', 'in_service', 'scheduled'])
      .order('start_time', { ascending: true });

    if (data) {
      setAppointments(data as Appointment[]);

      // Detect newly called patients for animation
      const newCalled = (data as Appointment[]).filter(
        a => a.status === 'called' && !lastCalledIds.has(a.id)
      );

      if (newCalled.length > 0) {
        const newest = newCalled[newCalled.length - 1];
        setCallingPatient(newest);
        setLastCalledIds(prev2 => {
          const next = new Set(prev2);
          newCalled.forEach(a => next.add(a.id));
          return next;
        });

        // Play notification sound
        try {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = 800;
          gain.gain.value = 0.3;
          osc.start();
          osc.stop(ctx.currentTime + 0.15);
          setTimeout(() => {
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.frequency.value = 1000;
            gain2.gain.value = 0.3;
            osc2.start();
            osc2.stop(ctx.currentTime + 0.2);
          }, 200);
        } catch {
          // Audio context not supported
        }

        // Clear calling animation after 8 seconds
        setTimeout(() => setCallingPatient(null), 8000);
      }
    }
     
  }, [lastCalledIds]);

  // Initial fetch + periodic refresh
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!cancelled) await fetchAppointments();
    };
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('tv_panel_appointments')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'appointments'
      }, () => {
        fetchAppointments();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchAppointments]);

  // Auto-refresh every 30 seconds as fallback
  useEffect(() => {
    const interval = setInterval(fetchAppointments, 30000);
    return () => clearInterval(interval);
  }, [fetchAppointments]);

  const waiting = appointments
    .filter(a => a.status === 'waiting')
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  const called = appointments.filter(a => a.status === 'called');
  const inService = appointments.filter(a => a.status === 'in_service');
  const scheduled = appointments.filter(a => a.status === 'scheduled');

  const formatClock = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatTime = (time: string) => {
    try {
      return new Date(time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden relative flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-5 bg-black/20 border-b border-white/10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-400 flex items-center justify-center shadow-lg">
            <Stethoscope className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Centro Médico Aliança</h1>
            <p className="text-sm text-slate-400">Painel de Atendimento</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-4xl font-bold font-mono tracking-wider">{formatClock(currentTime)}</p>
          <p className="text-sm text-slate-400 mt-1">
            {currentTime.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </p>
        </div>
      </div>

      {/* Calling Patient Overlay */}
      {callingPatient && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in-0 duration-300">
          <div className="text-center animate-in zoom-in-95 duration-500">
            <div className="flex items-center justify-center gap-3 mb-6">
              <Volume2 className="w-10 h-10 text-teal-400 animate-pulse" />
            </div>
            <p className="text-2xl text-teal-400 font-medium mb-4 uppercase tracking-widest">Chamando</p>
            <p className="text-6xl font-bold mb-4 animate-pulse">
              {callingPatient.patient_name || 'Paciente'}
            </p>
            {callingPatient.doctor_name && (
              <p className="text-2xl text-slate-300">
                Dr(a). {callingPatient.doctor_name}
              </p>
            )}
            <div className="mt-8 flex justify-center gap-2">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-3 h-3 rounded-full bg-teal-400"
                  style={{ animation: `pulse 1.5s ease-in-out ${i * 0.3}s infinite` }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex gap-6 p-6 overflow-hidden">
        {/* Fila de Espera — main column */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
            <h2 className="text-xl font-bold uppercase tracking-wider text-slate-300">Fila de Espera</h2>
            <span className="ml-auto text-3xl font-bold text-teal-400">{waiting.length}</span>
          </div>

          <div className="flex-1 overflow-hidden">
            {waiting.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-slate-500 text-lg">Nenhum paciente na fila</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {waiting.map((apt, idx) => (
                  <div
                    key={apt.id}
                    className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                      idx === 0
                        ? 'bg-teal-500/20 border-teal-500/50 shadow-lg shadow-teal-500/10'
                        : 'bg-white/5 border-white/10'
                    }`}
                  >
                    <span className={`text-2xl font-bold w-12 text-center ${
                      idx === 0 ? 'text-teal-400' : 'text-slate-500'
                    }`}>
                      {idx + 1}º
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-lg font-semibold truncate ${
                        idx === 0 ? 'text-white' : 'text-slate-300'
                      }`}>
                        {apt.patient_name || 'Paciente'}
                      </p>
                      <p className="text-sm text-slate-500">
                        {formatTime(apt.start_time)}
                        {apt.doctor_name && ` · Dr(a). ${apt.doctor_name}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column — status summary */}
        <div className="w-80 flex flex-col gap-4">
          {/* Called */}
          {called.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400 mb-3">
                Chamados ({called.length})
              </h3>
              <div className="space-y-2">
                {called.map(apt => (
                  <div key={apt.id} className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <p className="text-sm text-slate-200 truncate flex-1">{apt.patient_name || 'Paciente'}</p>
                    <p className="text-xs text-slate-500">{formatTime(apt.start_time)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* In Service */}
          {inService.length > 0 && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400 mb-3">
                Em Atendimento ({inService.length})
              </h3>
              <div className="space-y-2">
                {inService.map(apt => (
                  <div key={apt.id} className="flex items-center gap-3">
                    <Stethoscope className="w-4 h-4 text-emerald-400 shrink-0" />
                    <p className="text-sm text-slate-200 truncate flex-1">{apt.patient_name || 'Paciente'}</p>
                    {apt.doctor_name && (
                      <p className="text-xs text-slate-500 truncate">Dr(a). {apt.doctor_name}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming */}
          {scheduled.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex-1 overflow-hidden">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">
                Próximos ({scheduled.length})
              </h3>
              <div className="space-y-2 overflow-y-auto max-h-full">
                {scheduled.slice(0, 10).map(apt => (
                  <div key={apt.id} className="flex items-center gap-3">
                    <p className="text-xs text-slate-500 w-12">{formatTime(apt.start_time)}</p>
                    <p className="text-sm text-slate-400 truncate flex-1">{apt.patient_name || 'Paciente'}</p>
                  </div>
                ))}
                {scheduled.length > 10 && (
                  <p className="text-xs text-slate-600 text-center pt-1">
                    + {scheduled.length - 10} mais
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-teal-400">{waiting.length + called.length}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Aguardando</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-emerald-400">{inService.length}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Atendendo</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer ticker */}
      <div className="px-8 py-3 bg-black/20 border-t border-white/10 flex items-center justify-between">
        <p className="text-xs text-slate-500">Atualização automática em tempo real</p>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <p className="text-xs text-slate-500">Conectado</p>
        </div>
      </div>
    </div>
  );
}
