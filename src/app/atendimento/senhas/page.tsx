'use client';

import { useState, useCallback, useEffect } from 'react';
import { Users, Baby, Accessibility } from 'lucide-react';
import TicketPrintLayout from '@/components/queue/TicketPrintLayout';
import type { KioskCategory } from '@/types/queue';

interface TicketResult {
  ticket_number: string;
  category: KioskCategory;
  label: string;
  created_at: string;
  estimated_wait_minutes: number;
}

/** Configuração visual de cada categoria do totem */
const CATEGORIES: {
  id: KioskCategory;
  label: string;
  color: string;
  hoverColor: string;
  icons?: React.ReactNode;
}[] = [
  {
    id: 'normal',
    label: 'NORMAL',
    color: 'bg-blue-500',
    hoverColor: 'hover:bg-blue-600',
  },
  {
    id: 'prioridade',
    label: 'PRIORIDADE',
    color: 'bg-red-700',
    hoverColor: 'hover:bg-red-800',
    icons: (
      <div className="flex items-center justify-center gap-3 mt-2 opacity-80">
        <Accessibility className="w-6 h-6" />
        <Users className="w-6 h-6" />
        <Baby className="w-6 h-6" />
      </div>
    ),
  },
  {
    id: 'laboratorio',
    label: 'LABORATÓRIO',
    color: 'bg-purple-400',
    hoverColor: 'hover:bg-purple-500',
  },
  {
    id: 'laboratorio_prioridade',
    label: 'LABORATÓRIO\nPRIORIDADE',
    color: 'bg-amber-600',
    hoverColor: 'hover:bg-amber-700',
  },
];

type ViewState = 'select' | 'loading' | 'ticket';

export default function SenhasPage() {
  const [view, setView] = useState<ViewState>('select');
  const [ticket, setTicket] = useState<TicketResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-reset após exibir ticket
  useEffect(() => {
    if (view !== 'ticket') return;

    const handleAfterPrint = () => {
      setTimeout(() => {
        setView('select');
        setTicket(null);
      }, 2000);
    };

    window.addEventListener('afterprint', handleAfterPrint);

    // Fallback: volta ao menu após 10 segundos
    const timeout = setTimeout(() => {
      setView('select');
      setTicket(null);
    }, 10000);

    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
      clearTimeout(timeout);
    };
  }, [view]);

  const handleSelectCategory = useCallback(async (category: KioskCategory) => {
    setView('loading');
    setError(null);

    try {
      const res = await fetch('/api/atendimento/queue/kiosk-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erro ao gerar senha');
      }

      const data: TicketResult = await res.json();
      setTicket(data);
      setView('ticket');

      // Disparar impressão automaticamente após breve delay para render
      setTimeout(() => window.print(), 500);
    } catch (err) {
      console.error('[Kiosk] Erro:', err);
      setError(err instanceof Error ? err.message : 'Erro inesperado');
      setView('select');
    }
  }, []);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 select-none">
      {/* Área de impressão (invisível na tela) */}
      {ticket && (
        <TicketPrintLayout
          ticketNumber={ticket.ticket_number}
          categoryLabel={ticket.label}
          category={ticket.category}
          createdAt={ticket.created_at}
          estimatedWaitMinutes={ticket.estimated_wait_minutes}
        />
      )}

      {/* === TELA DE SELEÇÃO === */}
      {view === 'select' && (
        <div className="w-full max-w-lg flex flex-col items-center gap-6">
          {/* Logo / Nome da Clínica */}
          <div className="text-center mb-4">
            <h1 className="text-3xl font-bold text-gray-800 tracking-wide">
              CENTRO MÉDICO
            </h1>
            <p className="text-lg text-gray-500 tracking-widest">
              ALIANÇA
            </p>
          </div>

          {/* Erro */}
          {error && (
            <div className="w-full bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-center">
              {error}
            </div>
          )}

          {/* Botões de categoria */}
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleSelectCategory(cat.id)}
              className={`
                w-full py-8 rounded-xl text-white font-bold text-3xl
                ${cat.color} ${cat.hoverColor}
                transition-all duration-200 active:scale-95
                shadow-lg hover:shadow-xl
                flex flex-col items-center justify-center
              `}
            >
              <span className="whitespace-pre-line leading-tight">
                {cat.label}
              </span>
              {cat.icons}
            </button>
          ))}
        </div>
      )}

      {/* === TELA DE LOADING === */}
      {view === 'loading' && (
        <div className="flex flex-col items-center gap-6">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-blue-400 border-t-transparent" />
          <p className="text-xl text-gray-600">Gerando sua senha...</p>
        </div>
      )}

      {/* === TELA DO TICKET === */}
      {view === 'ticket' && ticket && (
        <div className="w-full max-w-lg flex flex-col items-center gap-6 animate-in fade-in duration-300">
          <div className="text-center">
            <p className="text-lg text-gray-500 mb-2">Sua senha é</p>
            <p className="text-8xl font-bold text-gray-900">
              {ticket.ticket_number.replace(/^[A-Z]+/, '')}
            </p>
            <p className="text-2xl font-semibold text-gray-600 mt-2">
              {ticket.label}
            </p>
          </div>

          <div className="text-center text-gray-500">
            <p>Tempo estimado de espera: ~{ticket.estimated_wait_minutes} min</p>
            <p className="text-sm mt-1">Aguarde sua senha ser chamada no painel</p>
          </div>

          {/* Botão para reimprimir */}
          <button
            onClick={() => window.print()}
            className="px-6 py-3 bg-gray-200 hover:bg-gray-300 rounded-lg text-gray-700 font-medium transition-colors"
          >
            Reimprimir
          </button>

          {/* Botão para voltar */}
          <button
            onClick={() => { setView('select'); setTicket(null); }}
            className="text-sm text-gray-400 hover:text-gray-600 underline"
          >
            Nova senha
          </button>
        </div>
      )}
    </div>
  );
}
