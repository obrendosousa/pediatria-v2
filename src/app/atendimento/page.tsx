'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import AtendimentoSidebar from '@/components/atendimento/Sidebar';
import AtendimentoChatWindow from '@/components/atendimento/ChatWindow';
import { Chat } from '@/types';
import { Stethoscope, ShieldCheck, Zap, Activity } from 'lucide-react';

export default function AtendimentoChatPage() {
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const searchParams = useSearchParams();
  const openedChatRef = useRef<number | null>(null);

  // Abre automaticamente o chat quando ?chatId=N estiver na URL
  useEffect(() => {
    const chatId = Number(searchParams.get('chatId'));
    if (!chatId || openedChatRef.current === chatId) return;
    openedChatRef.current = chatId;
    window.dispatchEvent(new CustomEvent('clara:open_chat', { detail: { chatId } }));
  }, [searchParams]);

  return (
    <div className="flex h-screen min-w-0 bg-[#F8FAFC] dark:bg-[#08080b] overflow-hidden transition-colors duration-300 relative">

      {/* Sidebar de Chats */}
      <AtendimentoSidebar
        onSelectChat={setSelectedChat}
        selectedChatId={selectedChat?.id}
      />

      {/* Área Principal */}
      <div className="flex-1 min-w-0 flex flex-col h-full relative">

        {selectedChat ? (
          <AtendimentoChatWindow chat={selectedChat} />
        ) : (
          // --- DASHBOARD DE STANDBY (tema azul) ---
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden bg-white/40 dark:bg-[#131316] transition-colors duration-300">

            {/* Decoração Sutil (Glow azul) */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-50/30 dark:bg-blue-900/5 rounded-full blur-[100px] pointer-events-none transition-colors duration-500"></div>

            <div className="relative z-10 flex flex-col items-center max-w-sm animate-fade-in-up">

              {/* Ícone principal */}
              <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-500 rounded-2xl shadow-xl shadow-blue-200/50 dark:shadow-blue-900/30 flex items-center justify-center mb-6 rotate-3">
                <Stethoscope className="w-10 h-10 text-white" strokeWidth={1.8} />
              </div>

              <h1 className="text-2xl font-bold text-slate-800 dark:text-[#fafafa] mb-2 transition-colors">
                Atendimento — Clínica Geral
              </h1>
              <p className="text-slate-500 dark:text-[#a1a1aa] text-sm leading-relaxed mb-8 transition-colors">
                Selecione uma conversa ao lado para iniciar o atendimento.
              </p>

              {/* Status Compactos */}
              <div className="grid grid-cols-2 gap-3 w-full mb-8">
                {/* Card IA */}
                <div className="bg-white dark:bg-[#1c1c21] p-3.5 rounded-xl border border-slate-100 dark:border-[#3d3d48] shadow-sm flex items-center gap-3 hover:border-blue-200 dark:hover:border-blue-500/30 transition-all cursor-default">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-300">
                        <Activity className="w-4 h-4"/>
                    </div>
                    <div className="text-left">
                        <p className="text-[10px] font-semibold text-slate-400 dark:text-[#71717a] uppercase tracking-wider">Copiloto IA</p>
                        <p className="text-xs font-bold text-blue-700 dark:text-blue-300">Ativa</p>
                    </div>
                </div>

                {/* Card Conexão */}
                <div className="bg-white dark:bg-[#1c1c21] p-3.5 rounded-xl border border-slate-100 dark:border-[#3d3d48] shadow-sm flex items-center gap-3 hover:border-indigo-200 dark:hover:border-indigo-500/30 transition-all cursor-default">
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600 dark:text-indigo-300">
                        <Zap className="w-4 h-4"/>
                    </div>
                    <div className="text-left">
                        <p className="text-[10px] font-semibold text-slate-400 dark:text-[#71717a] uppercase tracking-wider">WhatsApp</p>
                        <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300">Conectado</p>
                    </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[10px] font-medium text-slate-400 dark:text-[#71717a] bg-white/80 dark:bg-[#1c1c21]/80 backdrop-blur-sm px-4 py-2 rounded-full border border-slate-100 dark:border-[#3d3d48] transition-colors">
                <ShieldCheck className="w-3.5 h-3.5" /> Criptografia ponta a ponta
              </div>

            </div>
          </div>
        )}
      </div>

      {/* Container para modais */}
      <div id="modal-root" className="fixed inset-0 z-[99999] pointer-events-none" aria-hidden="true" />
    </div>
  );
}
