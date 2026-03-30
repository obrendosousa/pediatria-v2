'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import ChatWindow from '@/components/ChatWindow';
import SecretaryCheckoutDrawer from '@/components/SecretaryCheckoutDrawer';
import { Chat } from '@/types';
import { Stethoscope, ShieldCheck, Zap, Activity } from 'lucide-react';

export default function Home() {
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const searchParams = useSearchParams();
  const openedChatRef = useRef<number | null>(null);

  // Abre automaticamente o chat quando ?chatId=N estiver na URL (vindo do viewer de relatório)
  useEffect(() => {
    const chatId = Number(searchParams.get('chatId'));
    if (!chatId || openedChatRef.current === chatId) return;
    openedChatRef.current = chatId;
    window.dispatchEvent(new CustomEvent('clara:open_chat', { detail: { chatId } }));
  }, [searchParams]);

  return (
    // Fundo ajustado: Claro (#fffafa) | Escuro (#0b141a - tom profundo)
    <div className="flex h-full min-w-0 bg-[#fffafa] dark:bg-[#0b141a] overflow-hidden transition-colors duration-300 relative">
      
      {/* Sidebar de Navegação */}
      <Sidebar 
        onSelectChat={setSelectedChat} 
        selectedChatId={selectedChat?.id}
      />

      {/* Área Principal */}
      <div className="flex-1 min-w-0 flex flex-col h-full relative">
        
        {selectedChat ? (
          <ChatWindow chat={selectedChat} />
        ) : (
          // --- DASHBOARD DE STANDBY (Compacto) ---
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden bg-[#fef7fb] dark:bg-[#0c0c10] transition-colors duration-300">

            {/* Decoração Sutil (Glow) */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-rose-100/30 dark:bg-white/[0.02] rounded-full blur-[120px] pointer-events-none transition-colors duration-500"></div>

            <div className="relative z-10 flex flex-col items-center max-w-sm animate-fade-in-up">
              
              {/* Ícone com gradiente */}
              <div className="w-20 h-20 bg-gradient-to-br from-rose-400 to-rose-300 rounded-2xl shadow-xl shadow-rose-200/50 dark:shadow-none flex items-center justify-center mb-6 rotate-3">
                <Stethoscope className="w-10 h-10 text-white" strokeWidth={1.8} />
              </div>

              <h1 className="text-2xl font-bold text-slate-800 dark:text-[#e4e4e7] mb-2 transition-colors">
                Painel de Atendimento
              </h1>
              <p className="text-slate-500 dark:text-[#a1a1aa] text-sm leading-relaxed mb-8 transition-colors">
                Selecione um paciente ao lado para iniciar a triagem ou o atendimento médico.
              </p>

              {/* Status Compactos */}
              <div className="grid grid-cols-2 gap-3 w-full mb-8">
                {/* Card IA */}
                <div className="bg-white dark:bg-[#16161b] p-3.5 rounded-xl border border-slate-100 dark:border-[#2a2a30] shadow-sm dark:shadow-none flex items-center gap-3 hover:border-purple-200 dark:hover:border-[#35353d] transition-all cursor-default">
                    <div className="p-2 bg-purple-50 dark:bg-purple-500/10 rounded-lg text-purple-500 dark:text-purple-400">
                        <Activity className="w-4 h-4"/>
                    </div>
                    <div className="text-left">
                        <p className="text-[10px] font-semibold text-slate-400 dark:text-[#71717a] uppercase tracking-wider">Copiloto IA</p>
                        <p className="text-xs font-bold text-purple-700 dark:text-purple-400">Ativa</p>
                    </div>
                </div>

                {/* Card Conexão */}
                <div className="bg-white dark:bg-[#16161b] p-3.5 rounded-xl border border-slate-100 dark:border-[#2a2a30] shadow-sm dark:shadow-none flex items-center gap-3 hover:border-rose-200 dark:hover:border-[#35353d] transition-all cursor-default">
                    <div className="p-2 bg-rose-50 dark:bg-rose-500/10 rounded-lg text-rose-500 dark:text-rose-400">
                        <Zap className="w-4 h-4"/>
                    </div>
                    <div className="text-left">
                        <p className="text-[10px] font-semibold text-slate-400 dark:text-[#71717a] uppercase tracking-wider">WhatsApp</p>
                        <p className="text-xs font-bold text-rose-600 dark:text-rose-400">Conectado</p>
                    </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[10px] font-medium text-slate-400 dark:text-[#71717a] bg-white/80 dark:bg-[#16161b]/80 backdrop-blur-sm px-4 py-2 rounded-full border border-slate-100 dark:border-[#2a2a30] transition-colors">
                <ShieldCheck className="w-3.5 h-3.5" /> Criptografia ponta a ponta
              </div>

            </div>
          </div>
        )}
      </div>

      {/* Módulo da Secretária */}
      <SecretaryCheckoutDrawer />

      {/* Container para modais (TagSelector) - último filho para ficar acima de tudo */}
      <div id="modal-root" className="fixed inset-0 z-[99999] pointer-events-none" aria-hidden="true" />
    </div>
  );
}