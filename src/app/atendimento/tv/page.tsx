'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import { getTodayDateString } from '@/utils/dateUtils';
import type { TVCallPayload } from '@/types/queue';
import { Volume2, Stethoscope, Clock, Users, ArrowRight, Activity, Heart, Sun, Moon, VolumeX } from 'lucide-react';

const supabase = createSchemaClient('atendimento');

// Clinic brand colors
const BRAND = {
  blue: '#2B47A5',
  blueDark: '#1E3380',
  blueLight: '#3B5BC0',
  cyan: '#00BCD4',
  cyanDark: '#0097A7',
  red: '#DC2626',
  redDark: '#B91C1C',
  redLight: '#EF4444',
};

// ── Particle System ──
interface Particle {
  x: number; y: number; vx: number; vy: number;
  size: number; opacity: number; hue: number;
}

function useParticles(canvasRef: React.RefObject<HTMLCanvasElement | null>, isLight: boolean) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const particles: Particle[] = [];
    const PARTICLE_COUNT = 80;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.3 + 0.05,
        hue: Math.random() > 0.5 ? 220 : 185,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const connAlpha = isLight ? 0.035 : 0.06;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            const alpha = (1 - dist / 120) * connAlpha;
            ctx.beginPath();
            ctx.strokeStyle = `hsla(220, 60%, ${isLight ? '50%' : '60%'}, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        const lightness = isLight ? '50%' : '70%';
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 4);
        gradient.addColorStop(0, `hsla(${p.hue}, 60%, ${lightness}, ${p.opacity})`);
        gradient.addColorStop(1, `hsla(${p.hue}, 60%, ${lightness}, 0)`);
        ctx.beginPath();
        ctx.fillStyle = gradient;
        ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = `hsla(${p.hue}, 70%, ${isLight ? '40%' : '80%'}, ${p.opacity * 2})`;
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [canvasRef, isLight]);
}

// Tipo interno para dados da TV
type TVAppointment = {
  id: number;
  patient_name: string | null;
  doctor_name: string | null;
  status: string;
  time: string | null;
  queue_stage: string | null;
};

type TVTicket = {
  id: number;
  appointment_id: number;
  ticket_number: string;
  status: string;
  is_priority: boolean;
  called_at: string | null;
  queue_stage: string;
  service_point: { name: string; code: string } | null;
  appointment: { patient_id: number | null; patients: { full_name: string } | null } | null;
};

type LastCallEntry = {
  ticket: string;
  destination: string;
  patientName: string;
  isPriority: boolean;
};

export default function TVPanelPage() {
  const searchParams = useSearchParams();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isLight, setIsLight] = useState(() => searchParams.get('theme') !== 'dark');
  const [soundEnabled, setSoundEnabled] = useState(false);

  // Dados reais
  const [tvAppointments, setTvAppointments] = useState<TVAppointment[]>([]);
  const [lastCalls, setLastCalls] = useState<LastCallEntry[]>([]);

  // Overlay de chamada
  const [callOverlay, setCallOverlay] = useState<TVCallPayload | null>(null);
  const overlayTimerRef = useRef<NodeJS.Timeout | null>(null);

  useParticles(canvasRef, isLight);

  // Buscar appointments do dia
  const fetchAppointments = useCallback(async () => {
    const today = getTodayDateString();
    const { data, error } = await supabase
      .from('appointments')
      .select('id, doctor_id, status, time, queue_stage, patient_id, patients:patient_id(full_name)')
      .eq('date', today)
      .in('status', ['waiting', 'called', 'in_service', 'scheduled', 'confirmed'])
      .order('time', { ascending: true });

    if (error) {
      console.error('[TV] fetchAppointments error:', error);
      return;
    }
    if (data) {
      const mapped: TVAppointment[] = (data as Array<Record<string, unknown>>).map(row => {
        const patient = row.patients as { full_name?: string } | null;
        return {
          id: row.id as number,
          patient_name: patient?.full_name || null,
          doctor_name: null,
          status: row.status as string,
          time: row.time as string | null,
          queue_stage: row.queue_stage as string | null,
        };
      });
      setTvAppointments(mapped);
    }
  }, []);

  // Buscar ultimas chamadas (tickets chamados hoje)
  const fetchLastCalls = useCallback(async () => {
    const today = getTodayDateString();
    const { data, error } = await supabase
      .from('queue_tickets')
      .select(`
        id, appointment_id, ticket_number, status, is_priority, called_at, queue_stage,
        service_point:service_point_id(name, code),
        appointment:appointment_id(
          patient_id,
          patients:patient_id(full_name)
        )
      `)
      .eq('ticket_date', today)
      .in('status', ['called', 'in_service', 'completed'])
      .not('called_at', 'is', null)
      .order('called_at', { ascending: false })
      .limit(6);

    if (error) {
      console.error('[TV] fetchLastCalls error:', error);
      return;
    }
    if (data) {
      const entries: LastCallEntry[] = (data as unknown as TVTicket[]).map(tk => ({
        ticket: tk.ticket_number,
        destination: tk.service_point?.name || '',
        patientName: tk.appointment?.patients?.full_name || '',
        isPriority: tk.is_priority,
      }));
      setLastCalls(entries);
    }
  }, []);

  // Carregar dados iniciais
  useEffect(() => {
    fetchAppointments();
    fetchLastCalls();
  }, [fetchAppointments, fetchLastCalls]);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Realtime: postgres_changes + broadcast para chamadas
  useEffect(() => {
    const channel = supabase
      .channel('tv_panel_live')
      .on('postgres_changes', { event: '*', schema: 'atendimento', table: 'appointments' }, () => {
        fetchAppointments();
      })
      .on('postgres_changes', { event: '*', schema: 'atendimento', table: 'queue_tickets' }, () => {
        fetchLastCalls();
        fetchAppointments();
      })
      .subscribe();

    // Canal broadcast separado para chamadas com TTS
    const broadcastChannel = supabase
      .channel('tv-queue')
      .on('broadcast', { event: 'call' }, ({ payload }) => {
        const callData = payload as TVCallPayload;
        showCallOverlay(callData);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(broadcastChannel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchAppointments, fetchLastCalls]);

  // Polling de backup a cada 30s
  useEffect(() => {
    const i = setInterval(() => { fetchAppointments(); fetchLastCalls(); }, 30000);
    return () => clearInterval(i);
  }, [fetchAppointments, fetchLastCalls]);

  // Mostrar overlay de chamada + tocar audio TTS
  const showCallOverlay = (data: TVCallPayload) => {
    if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
    setCallOverlay(data);

    // Tocar audio TTS se disponivel e som habilitado
    if (data.tts_audio_url && soundEnabled) {
      const audio = new Audio(data.tts_audio_url);
      audio.play().catch(() => {});
    } else if (soundEnabled) {
      // Beep fallback
      try {
        const ctx = new AudioContext();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.value = 800; g.gain.value = 0.3;
        o.start(); o.stop(ctx.currentTime + 0.15);
        setTimeout(() => {
          const o2 = ctx.createOscillator();
          const g2 = ctx.createGain();
          o2.connect(g2); g2.connect(ctx.destination);
          o2.frequency.value = 1000; g2.gain.value = 0.3;
          o2.start(); o2.stop(ctx.currentTime + 0.2);
        }, 200);
      } catch { /* */ }
    }

    overlayTimerRef.current = setTimeout(() => setCallOverlay(null), 10000);
  };

  // Ativar som (necessario pelo autoplay policy)
  const enableSound = () => {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 600; g.gain.value = 0.1;
    o.start(); o.stop(ctx.currentTime + 0.05);
    setSoundEnabled(true);
  };

  // Listas derivadas
  const waiting = tvAppointments.filter(a => a.status === 'waiting');
  const inService = tvAppointments.filter(a => a.status === 'in_service' && (a.queue_stage === 'doctor' || !a.queue_stage));
  const called = tvAppointments.filter(a => a.status === 'called');

  // Chamada atual (ultimo chamado se nao houver overlay)
  const currentCallFromList = lastCalls.length > 0 ? lastCalls[0] : null;

  const formatClock = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // ── Theme tokens ──
  const th = isLight ? {
    pageBg: 'bg-[#F0F2F8]',
    pageText: 'text-gray-900',
    acText: `text-[${BRAND.blue}]`,
    acBg: `bg-[${BRAND.blue}]`,
    textPrimary: 'text-gray-900',
    textSecondary: 'text-gray-600',
    textTertiary: 'text-gray-400',
    textQuaternary: 'text-gray-300',
    emptyText: 'text-gray-200',
    cyanDot: `bg-[${BRAND.cyan}]`,
    emeraldTextMuted: 'text-emerald-600/50',
    emeraldDot: 'bg-emerald-500',
    emeraldBadge: 'text-emerald-600/80',
    clockText: `text-[${BRAND.blueDark}]`,
    dateText: 'text-gray-400',
    overlayBg: 'bg-white/95',
    footerDot: 'bg-emerald-500',
    footerText: 'text-gray-300',
    footerBrand: 'text-gray-200',
  } : {
    pageBg: 'bg-[#080B1A]',
    pageText: 'text-white',
    acText: 'text-blue-400',
    acBg: 'bg-blue-500',
    textPrimary: 'text-white/95',
    textSecondary: 'text-white/60',
    textTertiary: 'text-white/25',
    textQuaternary: 'text-white/15',
    emptyText: 'text-white/10',
    cyanDot: 'bg-cyan-400',
    emeraldTextMuted: 'text-emerald-400/40',
    emeraldDot: 'bg-emerald-400/60',
    emeraldBadge: 'text-emerald-400/70',
    clockText: 'text-blue-200/80',
    dateText: 'text-white/20',
    overlayBg: 'bg-[#080B1A]/90',
    footerDot: 'bg-emerald-400',
    footerText: 'text-white/15',
    footerBrand: 'text-white/8',
  };

  const cardClass = isLight ? 'tv-card-light' : 'tv-card-dark';
  const innerClass = isLight ? 'tv-card-inner-light' : 'tv-card-inner-dark';

  return (
    <div className={`h-screen w-screen ${th.pageBg} ${th.pageText} overflow-hidden flex flex-col select-none relative`}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes tv-pulse { 0%,100% { opacity:1 } 50% { opacity:.3 } }
        @keyframes tv-float { 0%,100% { transform:translateY(0) } 50% { transform:translateY(-8px) } }
        @keyframes tv-slide { from { transform:translateX(-30px);opacity:0 } to { transform:translateX(0);opacity:1 } }
        @keyframes tv-fade { from { opacity:0;transform:scale(.95) } to { opacity:1;transform:scale(1) } }
        @keyframes tv-border-glow-dark {
          0%,100% { border-color: rgba(43,71,165,0.12); box-shadow: 0 0 15px rgba(43,71,165,0.05) }
          50% { border-color: rgba(43,71,165,0.3); box-shadow: 0 0 30px rgba(43,71,165,0.1) }
        }
        @keyframes tv-border-glow-light {
          0%,100% { border-color: rgba(43,71,165,0.08); box-shadow: 0 2px 20px rgba(43,71,165,0.04) }
          50% { border-color: rgba(43,71,165,0.15); box-shadow: 0 2px 30px rgba(43,71,165,0.08) }
        }
        @keyframes tv-number-glow-dark {
          0%,100% { text-shadow: 0 0 10px rgba(96,165,250,0.2) }
          50% { text-shadow: 0 0 25px rgba(96,165,250,0.5) }
        }
        @keyframes tv-number-glow-light {
          0%,100% { text-shadow: none }
          50% { text-shadow: 0 0 15px rgba(43,71,165,0.12) }
        }
        .tv-slide { animation: tv-slide .6s ease-out both }
        .tv-fade { animation: tv-fade .5s ease-out both }
        .tv-card-dark {
          background: linear-gradient(135deg, rgba(43,71,165,0.06) 0%, rgba(255,255,255,0.01) 100%);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(43,71,165,0.08);
          animation: tv-border-glow-dark 6s ease-in-out infinite;
        }
        .tv-card-light {
          background: rgba(255,255,255,0.88);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(43,71,165,0.08);
          box-shadow: 0 1px 12px rgba(43,71,165,0.04);
          animation: tv-border-glow-light 6s ease-in-out infinite;
        }
        .tv-card-inner-dark {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.03);
        }
        .tv-card-inner-light {
          background: rgba(43,71,165,0.03);
          border: 1px solid rgba(43,71,165,0.06);
        }
      ` }} />

      {/* ── Particle Canvas ── */}
      <canvas ref={canvasRef} className="fixed inset-0 z-0 pointer-events-none" />

      {/* ── Ambient gradients ── */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        {isLight ? (
          <>
            <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-blue-300/[0.06] rounded-full blur-[150px]" />
            <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-cyan-300/[0.05] rounded-full blur-[150px]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-blue-200/[0.04] rounded-full blur-[200px]" />
          </>
        ) : (
          <>
            <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-blue-600/[0.04] rounded-full blur-[150px]" />
            <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-cyan-500/[0.03] rounded-full blur-[150px]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-indigo-500/[0.02] rounded-full blur-[200px]" />
          </>
        )}
      </div>

      {/* ══════ HEADER ══════ */}
      <div className="relative z-10 flex items-center justify-between px-10 py-5">
        <div className="flex items-center gap-5">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl"
            style={{
              background: `linear-gradient(135deg, ${BRAND.blueLight}, ${BRAND.blueDark})`,
              boxShadow: `0 8px 30px ${BRAND.blue}33`,
              animation: 'tv-float 4s ease-in-out infinite',
            }}
          >
            <Heart className="w-7 h-7 fill-red-500 text-red-500" />
          </div>
          <div>
            <h1
              className="text-3xl font-bold tracking-tight"
              style={{ color: isLight ? BRAND.blueDark : '#fff' }}
            >
              Centro Médico Aliança
            </h1>
            <p
              className="text-sm font-medium tracking-[0.25em] uppercase"
              style={{ color: isLight ? BRAND.blue + 'AA' : '#60A5FA99' }}
            >
              Painel de Atendimento
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          {/* Som toggle */}
          <button
            onClick={() => soundEnabled ? setSoundEnabled(false) : enableSound()}
            className={`p-2.5 rounded-xl transition-all ${
              soundEnabled
                ? isLight ? 'bg-emerald-50 text-emerald-600' : 'bg-emerald-500/10 text-emerald-400'
                : isLight ? 'bg-red-50 text-red-400' : 'bg-red-500/10 text-red-400'
            }`}
            title={soundEnabled ? 'Som ativado' : 'Clique para ativar som'}
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
          {/* Theme toggle */}
          <button
            onClick={() => setIsLight(v => !v)}
            className={`p-2.5 rounded-xl transition-all ${
              isLight
                ? 'bg-blue-50 hover:bg-blue-100 text-blue-400'
                : 'bg-white/5 hover:bg-white/10 text-white/30'
            }`}
          >
            {isLight ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>
          <div className="text-right">
            <p
              className={`text-5xl font-extralight font-mono tracking-[0.2em] ${th.clockText}`}
              style={{ animation: `${isLight ? 'tv-number-glow-light' : 'tv-number-glow-dark'} 4s ease-in-out infinite` }}
            >
              {formatClock(currentTime)}
            </p>
            <p className={`text-sm ${th.dateText} mt-1 capitalize font-light`}>
              {currentTime.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div
        className="relative z-10 h-px mx-10"
        style={{
          background: `linear-gradient(to right, transparent, ${isLight ? BRAND.blue + '22' : BRAND.blue + '33'}, transparent)`,
        }}
      />

      {/* ══════ CALLING OVERLAY ══════ */}
      {callOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setCallOverlay(null)}>
          <div className={`absolute inset-0 ${th.overlayBg} backdrop-blur-xl`} />
          <div className="relative text-center tv-fade max-w-4xl mx-auto px-8">
            <div className="mb-6">
              <Volume2
                className="w-16 h-16 mx-auto"
                style={{ color: BRAND.red, animation: 'tv-pulse 1s ease-in-out infinite' }}
              />
            </div>
            <p className="text-lg font-semibold mb-4 uppercase tracking-[0.5em]" style={{ color: BRAND.red }}>
              Chamando
            </p>
            {/* Senha grande */}
            <p
              className={`text-[120px] font-black leading-none mb-4 tracking-wider ${
                callOverlay.is_priority
                  ? 'text-red-600'
                  : isLight ? 'text-gray-900' : 'text-white'
              }`}
              style={{ animation: 'tv-pulse 2.5s ease-in-out infinite' }}
            >
              {callOverlay.ticket_number.replace(/([A-Z])(\d)/, '$1 $2')}
            </p>
            {/* Nome do paciente */}
            <p className={`text-5xl font-bold mb-6 ${isLight ? 'text-gray-800' : 'text-white/90'}`}>
              {callOverlay.patient_name}
            </p>
            {/* Destino */}
            <div className="flex items-center justify-center gap-4 mb-4">
              <ArrowRight className="w-8 h-8" style={{ color: BRAND.blue }} />
              <p className={`text-3xl font-semibold ${isLight ? 'text-blue-700' : 'text-blue-300'}`}>
                {callOverlay.service_point_name}
              </p>
            </div>
            {callOverlay.doctor_name && (
              <p className={`text-xl font-light ${isLight ? 'text-gray-400' : 'text-white/40'}`}>
                {callOverlay.doctor_name}
              </p>
            )}
            {callOverlay.is_priority && (
              <span className="inline-block mt-4 px-4 py-1.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm font-bold uppercase tracking-wider">
                Prioridade
              </span>
            )}
            <div className="mt-10 flex justify-center gap-4">
              {[0, 1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: BRAND.red, animation: `tv-pulse 1.5s ease-in-out ${i * 0.15}s infinite` }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════ MAIN ══════ */}
      <div className="flex-1 flex overflow-hidden relative z-10 p-6 pt-5 gap-5">

        {/* ── LEFT ── */}
        <div className="flex-1 flex flex-col gap-5">

          {/* Chamada Atual */}
          <div className={`${cardClass} rounded-2xl p-8 flex-shrink-0`}>
            <div className="flex items-center gap-3 mb-6">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: BRAND.red, animation: 'tv-pulse 2s ease-in-out infinite' }}
              />
              <h2 className="text-xs font-bold uppercase tracking-[0.25em]" style={{ color: isLight ? BRAND.red + 'CC' : '#F87171AA' }}>
                Última Chamada
              </h2>
            </div>
            {currentCallFromList ? (
              <div className="tv-slide">
                <div className="flex items-center gap-6 mb-4">
                  <span
                    className={`text-4xl font-black tracking-wider ${currentCallFromList.isPriority ? 'text-red-600' : (isLight ? 'text-blue-700' : 'text-blue-400')}`}
                  >
                    {currentCallFromList.ticket}
                  </span>
                  <span className={`text-4xl font-bold ${th.textPrimary}`}>{currentCallFromList.patientName}</span>
                </div>
                {currentCallFromList.destination && (
                  <div className="flex items-center gap-3">
                    <ArrowRight className="w-5 h-5" style={{ color: BRAND.blue }} />
                    <span className={`text-lg font-medium ${th.textSecondary}`}>{currentCallFromList.destination}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className={`text-3xl ${th.emptyText} font-light`}>Nenhuma chamada no momento</p>
            )}
          </div>

          {/* Fila de Espera */}
          <div className={`flex-1 ${cardClass} rounded-2xl p-6 overflow-hidden flex flex-col`}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <Users className={`w-5 h-5 ${th.textQuaternary}`} />
                <h2 className={`text-xs font-bold uppercase tracking-[0.25em] ${th.textTertiary}`}>Fila de Espera</h2>
              </div>
              <span
                className="text-2xl font-bold"
                style={{
                  color: isLight ? BRAND.blue : '#60A5FA',
                  animation: `${isLight ? 'tv-number-glow-light' : 'tv-number-glow-dark'} 4s ease-in-out infinite`,
                }}
              >
                {waiting.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5">
              {waiting.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className={`${th.emptyText} text-xl font-light`}>Nenhum paciente aguardando</p>
                </div>
              ) : waiting.map((apt, idx) => (
                <div
                  key={apt.id}
                  className={`flex items-center gap-4 px-5 py-4 rounded-xl tv-slide transition-all ${
                    idx === 0
                      ? 'border'
                      : `${innerClass} ${isLight ? 'hover:bg-blue-50/50' : 'hover:bg-white/[0.03]'}`
                  }`}
                  style={idx === 0 ? {
                    backgroundColor: isLight ? BRAND.blue + '0D' : BRAND.blue + '1A',
                    borderColor: isLight ? BRAND.blue + '25' : BRAND.blue + '33',
                    animationDelay: `${idx * 0.08}s`,
                  } : { animationDelay: `${idx * 0.08}s` }}
                >
                  <span
                    className="text-xl font-bold w-10 text-center tabular-nums"
                    style={{ color: idx === 0 ? (isLight ? BRAND.blue : '#60A5FA') : undefined }}
                  >
                    <span className={idx !== 0 ? th.textQuaternary : ''}>{idx + 1}º</span>
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-lg font-semibold truncate ${idx === 0 ? th.textPrimary : th.textSecondary}`}>{apt.patient_name}</p>
                  </div>
                  <div className={`flex items-center gap-2 ${th.textQuaternary} text-sm`}>
                    <Clock className="w-3.5 h-3.5" />
                    <span className="tabular-nums">{apt.time || ''}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT ── */}
        <div className="w-[400px] flex flex-col gap-5">

          {/* Ultimas Chamadas */}
          <div className={`${cardClass} rounded-2xl p-6`}>
            <div className="flex items-center gap-3 mb-5">
              <div className={`w-2 h-2 rounded-full ${th.cyanDot}`} style={{ animation: 'tv-pulse 2s ease-in-out infinite' }} />
              <h2 className="text-xs font-bold uppercase tracking-[0.25em]" style={{ color: isLight ? BRAND.cyanDark + '99' : '#22D3EE77' }}>
                Últimas Chamadas
              </h2>
            </div>
            <div className="space-y-1">
              <div className={`flex px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] ${th.textQuaternary}`}>
                <span className="w-20">Senha</span>
                <span className="flex-1">Paciente</span>
                <span className="w-28 text-right">Destino</span>
              </div>
              {lastCalls.length === 0 ? (
                <p className={`text-center text-sm ${th.emptyText} py-4`}>Nenhuma chamada ainda</p>
              ) : lastCalls.map((call, idx) => (
                <div
                  key={idx}
                  className={`flex items-center px-4 py-3 rounded-lg ${
                    idx === 0
                      ? 'border'
                      : isLight ? 'bg-gray-50' : 'bg-white/[0.015]'
                  }`}
                  style={idx === 0 ? {
                    backgroundColor: isLight ? BRAND.red + '0D' : BRAND.red + '15',
                    borderColor: isLight ? BRAND.red + '25' : BRAND.red + '33',
                  } : undefined}
                >
                  <span
                    className={`w-20 font-mono font-bold text-sm tracking-wider ${idx === 0 ? '' : th.textTertiary}`}
                    style={idx === 0 ? { color: isLight ? BRAND.red : BRAND.redLight } : undefined}
                  >
                    {call.ticket}
                  </span>
                  <span className={`flex-1 text-sm truncate ${idx === 0 ? th.textPrimary : th.textSecondary} font-medium`}>
                    {call.patientName}
                  </span>
                  <span
                    className={`w-28 text-right text-xs font-medium ${idx === 0 ? '' : th.textQuaternary}`}
                    style={idx === 0 ? { color: isLight ? BRAND.blue : '#60A5FA' } : undefined}
                  >
                    {call.destination}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Consultorios */}
          <div className={`flex-1 ${cardClass} rounded-2xl p-6 overflow-hidden flex flex-col`}>
            <div className="flex items-center gap-3 mb-5">
              <Activity className={`w-4 h-4 ${th.emeraldTextMuted}`} />
              <h2 className={`text-xs font-bold uppercase tracking-[0.25em] ${th.textTertiary}`}>Em Atendimento</h2>
              <span className={`ml-auto text-sm font-bold ${th.emeraldBadge}`}>{inService.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {inService.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className={`${th.emptyText} text-sm font-light`}>Nenhum atendimento</p>
                </div>
              ) : inService.map((apt, idx) => (
                <div key={apt.id} className={`${innerClass} rounded-xl p-4 tv-slide`} style={{ animationDelay: `${idx * 0.1}s` }}>
                  <div className="flex items-center gap-3 mb-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${th.emeraldDot}`} />
                    <p className={`text-base font-semibold ${isLight ? 'text-gray-700' : 'text-white/75'} truncate`}>{apt.patient_name}</p>
                  </div>
                  <div className="flex items-center gap-4 pl-5 text-sm">
                    {apt.doctor_name && (
                      <span className="flex items-center gap-1.5">
                        <Stethoscope className={`w-3 h-3 ${th.textQuaternary}`} />
                        <span className={th.textQuaternary}>{apt.doctor_name}</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: waiting.length, label: 'Na Fila', color: isLight ? BRAND.blue : '#60A5FA' },
              { value: inService.length, label: 'Atendendo', color: isLight ? '#059669' : '#34D399' },
              { value: called.length, label: 'Chamados', color: isLight ? BRAND.red : BRAND.redLight },
            ].map((s, i) => (
              <div key={i} className={`${cardClass} rounded-2xl p-5 text-center`}>
                <p
                  className="text-3xl font-bold tabular-nums"
                  style={{
                    color: s.color,
                    animation: `${isLight ? 'tv-number-glow-light' : 'tv-number-glow-dark'} 4s ease-in-out infinite`,
                  }}
                >
                  {s.value}
                </p>
                <p className={`text-[9px] ${th.textQuaternary} uppercase tracking-[0.2em] mt-2 font-semibold`}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════ FOOTER ══════ */}
      <div className="relative z-10 px-10 py-3 flex items-center justify-between">
        <div
          className="h-px flex-1 mr-6"
          style={{ background: `linear-gradient(to right, transparent, ${isLight ? '#0000000A' : '#ffffff08'}, transparent)` }}
        />
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${th.footerDot}`} style={{ animation: 'tv-pulse 3s ease-in-out infinite' }} />
            <p className={`text-[10px] ${th.footerText} font-medium tracking-wider`}>Tempo real</p>
          </div>
          <p className={`text-[10px] ${th.footerBrand} tracking-wider`}>Centro Médico Aliança</p>
        </div>
      </div>
    </div>
  );
}
