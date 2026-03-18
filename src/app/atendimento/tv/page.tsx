'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Appointment } from '@/types/medical';
import { getLocalDateRange, getTodayDateString } from '@/utils/dateUtils';
import { Volume2, Stethoscope, Clock, Users, ArrowRight, Activity, Heart, Sun, Moon } from 'lucide-react';

const supabase = createClient();

// Clinic brand colors
const BRAND = {
  blue: '#2B47A5',       // primary royal blue
  blueDark: '#1E3380',
  blueLight: '#3B5BC0',
  cyan: '#00BCD4',       // secondary cyan/turquoise
  cyanDark: '#0097A7',
  red: '#DC2626',        // accent red
  redDark: '#B91C1C',
  redLight: '#EF4444',
};

// Mock data
const MOCK_CALLED = [
  { id: 901, patient_name: 'Flávio Viana Damasceno', doctor_name: 'Dr. Egberto', location: 'Sala de Eletro', status: 'called' as const },
];
const MOCK_LAST_CALLS = [
  { ticket: '0040p', counter: 4 },
  { ticket: '0038', counter: 3 },
  { ticket: '0039p', counter: 5 },
  { ticket: '0037p', counter: 5 },
  { ticket: '0035e', counter: 5 },
];
const MOCK_IN_SERVICE = [
  { id: 801, patient_name: 'Maria Helena Costa', doctor_name: 'Dra. Renata', location: 'Consultório 1', status: 'in_service' as const },
  { id: 802, patient_name: 'Daniele dos Santos Lima', doctor_name: 'Dr. Egberto', location: 'Sala de Ultrassonografia', status: 'in_service' as const },
  { id: 803, patient_name: 'João Pedro Alves', doctor_name: 'Dr. Ricardo', location: 'Consultório 3', status: 'in_service' as const },
];
const MOCK_WAITING = [
  { id: 701, patient_name: 'Ana Beatriz Souza', doctor_name: 'Dra. Renata', start_time: '14:30', status: 'waiting' as const },
  { id: 702, patient_name: 'Carlos Eduardo Lima', doctor_name: 'Dr. Egberto', start_time: '14:45', status: 'waiting' as const },
  { id: 703, patient_name: 'Patricia Mendes', doctor_name: 'Dr. Ricardo', start_time: '15:00', status: 'waiting' as const },
  { id: 704, patient_name: 'Roberto Silva Neto', doctor_name: 'Dra. Renata', start_time: '15:15', status: 'waiting' as const },
  { id: 705, patient_name: 'Luciana Ferreira', doctor_name: 'Dr. Egberto', start_time: '15:30', status: 'waiting' as const },
];

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
        hue: Math.random() > 0.5 ? 220 : 185, // blue or cyan
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

export default function TVPanelPage() {
  const searchParams = useSearchParams();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [callingPatient, setCallingPatient] = useState<Appointment | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastCalledIds, setLastCalledIds] = useState<Set<number>>(new Set());
  const [useMock] = useState(true);
  const [isLight, setIsLight] = useState(() => searchParams.get('theme') !== 'dark');

  useParticles(canvasRef, isLight);

  const fetchAppointments = useCallback(async () => {
    const today = getTodayDateString();
    const { startOfDay, endOfDay } = getLocalDateRange(today);
    const { data } = await supabase
      .from('appointments').select('*')
      .gte('start_time', startOfDay).lte('start_time', endOfDay)
      .in('status', ['waiting', 'called', 'in_service', 'scheduled'])
      .order('start_time', { ascending: true });
    if (data) {
      setAppointments(data as Appointment[]);
      const newCalled = (data as Appointment[]).filter(a => a.status === 'called' && !lastCalledIds.has(a.id));
      if (newCalled.length > 0) {
        setCallingPatient(newCalled[newCalled.length - 1]);
        setLastCalledIds(prev => { const next = new Set(prev); newCalled.forEach(a => next.add(a.id)); return next; });
        try {
          const ctx = new AudioContext();
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination); o.frequency.value = 800; g.gain.value = 0.3;
          o.start(); o.stop(ctx.currentTime + 0.15);
          setTimeout(() => { const o2 = ctx.createOscillator(); const g2 = ctx.createGain(); o2.connect(g2); g2.connect(ctx.destination); o2.frequency.value = 1000; g2.gain.value = 0.3; o2.start(); o2.stop(ctx.currentTime + 0.2); }, 200);
        } catch { /* */ }
        setTimeout(() => setCallingPatient(null), 8000);
      }
    }
  }, [lastCalledIds]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => { if (!cancelled) await fetchAppointments(); };
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { const t = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const ch = supabase.channel('tv_panel').on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => fetchAppointments()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchAppointments]);
  useEffect(() => { const i = setInterval(fetchAppointments, 30000); return () => clearInterval(i); }, [fetchAppointments]);

  const waiting = useMock ? MOCK_WAITING : appointments.filter(a => a.status === 'waiting').sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  const called = useMock ? MOCK_CALLED : appointments.filter(a => a.status === 'called');
  const inService = useMock ? MOCK_IN_SERVICE : appointments.filter(a => a.status === 'in_service');
  const currentCall = called[0] || null;
  const lastCalls = useMock ? MOCK_LAST_CALLS : [];

  const formatClock = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // ── Theme tokens — Brand: Royal Blue + Cyan ──
  const th = isLight ? {
    pageBg: 'bg-[#F0F2F8]',
    pageText: 'text-gray-900',
    // Primary accent (royal blue)
    acText: `text-[${BRAND.blue}]`,
    acTextMuted: `text-[${BRAND.blue}]/70`,
    acBg: `bg-[${BRAND.blue}]`,
    acBgMuted: `bg-[${BRAND.blue}]/8`,
    acBorder: `border-[${BRAND.blue}]/20`,
    // Text hierarchy
    textPrimary: 'text-gray-900',
    textSecondary: 'text-gray-600',
    textTertiary: 'text-gray-400',
    textQuaternary: 'text-gray-300',
    emptyText: 'text-gray-200',
    // Cyan accent (reception)
    cyanText: `text-[${BRAND.cyanDark}]`,
    cyanTextMuted: `text-[${BRAND.cyanDark}]/60`,
    cyanBg: `bg-[${BRAND.cyan}]/8`,
    cyanBorder: `border-[${BRAND.cyan}]/20`,
    cyanDot: `bg-[${BRAND.cyan}]`,
    // Emerald (consultórios)
    emeraldText: 'text-emerald-600',
    emeraldTextMuted: 'text-emerald-600/50',
    emeraldDot: 'bg-emerald-500',
    emeraldBadge: 'text-emerald-600/80',
    // Clock
    clockText: `text-[${BRAND.blueDark}]`,
    dateText: 'text-gray-400',
    // Overlay
    overlayBg: 'bg-white/95',
    // Footer
    footerDot: 'bg-emerald-500',
    footerText: 'text-gray-300',
    footerBrand: 'text-gray-200',
  } : {
    pageBg: 'bg-[#080B1A]',
    pageText: 'text-white',
    // Primary accent (lighter blue for dark bg)
    acText: 'text-blue-400',
    acTextMuted: 'text-blue-400/60',
    acBg: 'bg-blue-500',
    acBgMuted: 'bg-blue-500/10',
    acBorder: 'border-blue-500/20',
    // Text hierarchy
    textPrimary: 'text-white/95',
    textSecondary: 'text-white/60',
    textTertiary: 'text-white/25',
    textQuaternary: 'text-white/15',
    emptyText: 'text-white/10',
    // Cyan accent
    cyanText: 'text-cyan-300',
    cyanTextMuted: 'text-cyan-400/50',
    cyanBg: 'bg-cyan-500/8',
    cyanBorder: 'border-cyan-500/10',
    cyanDot: 'bg-cyan-400',
    // Emerald
    emeraldText: 'text-emerald-400',
    emeraldTextMuted: 'text-emerald-400/40',
    emeraldDot: 'bg-emerald-400/60',
    emeraldBadge: 'text-emerald-400/70',
    // Clock
    clockText: 'text-blue-200/80',
    dateText: 'text-white/20',
    // Overlay
    overlayBg: 'bg-[#080B1A]/90',
    // Footer
    footerDot: 'bg-emerald-400',
    footerText: 'text-white/15',
    footerBrand: 'text-white/8',
  };

  const cardClass = isLight ? 'tv-card-light' : 'tv-card-dark';
  const innerClass = isLight ? 'tv-card-inner-light' : 'tv-card-inner-dark';

  return (
    <div className={`h-screen w-screen ${th.pageBg} ${th.pageText} overflow-hidden flex flex-col select-none relative`}>
      <style jsx global>{`
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
      `}</style>

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
          {/* Logo — red heart on blue */}
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
      {callingPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className={`absolute inset-0 ${th.overlayBg} backdrop-blur-xl`} />
          <div className="relative text-center tv-fade">
            <div className="mb-8">
              <Volume2
                className="w-20 h-20 mx-auto"
                style={{ color: BRAND.red, animation: 'tv-pulse 1s ease-in-out infinite' }}
              />
            </div>
            <p className="text-xl font-semibold mb-8 uppercase tracking-[0.5em]" style={{ color: BRAND.red }}>
              Chamando
            </p>
            <p
              className={`text-8xl font-bold mb-6 ${isLight ? 'text-gray-900' : 'text-white'}`}
              style={{ animation: 'tv-pulse 2.5s ease-in-out infinite' }}
            >
              {callingPatient.patient_name || 'Paciente'}
            </p>
            {callingPatient.doctor_name && (
              <p className={`text-3xl font-light ${isLight ? 'text-gray-400' : 'text-white/40'}`}>
                Dr(a). {callingPatient.doctor_name}
              </p>
            )}
            <div className="mt-12 flex justify-center gap-4">
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
                Chamada Atual
              </h2>
            </div>
            {currentCall ? (
              <div className="tv-slide">
                <p className={`text-5xl font-bold ${th.textPrimary} mb-4 leading-tight`}>{currentCall.patient_name}</p>
                <div className="flex items-center gap-8">
                  {(currentCall as typeof MOCK_CALLED[0]).location && (
                    <span className="flex items-center gap-3 text-lg">
                      <ArrowRight className="w-5 h-5" style={{ color: BRAND.blue }} />
                      <span className={`${th.textSecondary} font-medium`}>{(currentCall as typeof MOCK_CALLED[0]).location}</span>
                    </span>
                  )}
                  {currentCall.doctor_name && (
                    <span className={`flex items-center gap-3 text-lg ${th.textTertiary}`}>
                      <Stethoscope className="w-5 h-5" />
                      <span>{currentCall.doctor_name}</span>
                    </span>
                  )}
                </div>
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
                    <span className="tabular-nums">{typeof apt.start_time === 'string' && apt.start_time.includes(':') ? apt.start_time : ''}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT ── */}
        <div className="w-[400px] flex flex-col gap-5">

          {/* Recepção / Últimas Chamadas */}
          <div className={`${cardClass} rounded-2xl p-6`}>
            <div className="flex items-center gap-3 mb-5">
              <div className={`w-2 h-2 rounded-full ${th.cyanDot}`} style={{ animation: 'tv-pulse 2s ease-in-out infinite' }} />
              <h2 className="text-xs font-bold uppercase tracking-[0.25em]" style={{ color: isLight ? BRAND.cyanDark + '99' : '#22D3EE77' }}>
                Recepção
              </h2>
            </div>
            <div className="space-y-1">
              <div className={`flex px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] ${th.textQuaternary}`}>
                <span className="flex-1">Senha</span>
                <span className="w-20 text-center">Guichê</span>
              </div>
              {lastCalls.map((call, idx) => (
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
                    className={`flex-1 font-mono font-bold text-base tracking-wider ${idx === 0 ? '' : th.textTertiary}`}
                    style={idx === 0 ? { color: isLight ? BRAND.red : BRAND.redLight } : undefined}
                  >
                    {call.ticket}
                  </span>
                  <span
                    className={`w-20 text-center font-bold text-base ${idx === 0 ? '' : th.textQuaternary}`}
                    style={idx === 0 ? { color: isLight ? BRAND.red : BRAND.redLight } : undefined}
                  >
                    {call.counter}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Consultórios */}
          <div className={`flex-1 ${cardClass} rounded-2xl p-6 overflow-hidden flex flex-col`}>
            <div className="flex items-center gap-3 mb-5">
              <Activity className={`w-4 h-4 ${th.emeraldTextMuted}`} />
              <h2 className={`text-xs font-bold uppercase tracking-[0.25em] ${th.textTertiary}`}>Consultórios</h2>
              <span className={`ml-auto text-sm font-bold ${th.emeraldBadge}`}>{inService.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {inService.map((apt, idx) => (
                <div key={apt.id} className={`${innerClass} rounded-xl p-4 tv-slide`} style={{ animationDelay: `${idx * 0.1}s` }}>
                  <div className="flex items-center gap-3 mb-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${th.emeraldDot}`} />
                    <p className={`text-base font-semibold ${isLight ? 'text-gray-700' : 'text-white/75'} truncate`}>{apt.patient_name}</p>
                  </div>
                  <div className="flex items-center gap-4 pl-5 text-sm">
                    {(apt as typeof MOCK_IN_SERVICE[0]).location && (
                      <span className={`${th.emeraldTextMuted} font-medium`}>{(apt as typeof MOCK_IN_SERVICE[0]).location}</span>
                    )}
                    {apt.doctor_name && <span className={th.textQuaternary}>{apt.doctor_name}</span>}
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
