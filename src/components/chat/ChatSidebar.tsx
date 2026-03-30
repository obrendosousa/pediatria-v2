/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, @next/next/no-img-element */
import {
  Bot,
  FileText,
  Mic,
  Image as ImageIcon,
  Scroll,
  Workflow,
  CalendarClock,
  Search,
  Clock,
  Edit2,
  Trash2,
  Send,
  Loader2,
  Plus,
  Play,
  Orbit,
  Sparkles,
  CircleDashed,
  ChevronsRight,
  Menu,
  BotMessageSquare,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import AudioMessage from './AudioMessage';
import { Macro, Funnel, ScheduledMessage } from '@/types';
import { ExecutionItem } from '@/hooks/useChatAutomation';
import CopilotChat from './CopilotChat';

interface ChatSidebarProps {
  activeTab: 'text' | 'audio' | 'image' | 'script' | 'funnels' | 'schedule' | 'executions' | 'copiloto' | null;
  setActiveTab: (tab: 'text' | 'audio' | 'image' | 'script' | 'funnels' | 'schedule' | 'executions' | 'copiloto' | null) => void;
  chatId: number;
  patientName: string;
  macros: Macro[];
  funnels: Funnel[];
  scheduledMessages: ScheduledMessage[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  expandedItemId: string | number | null;
  setExpandedItemId: (id: string | number | null) => void;
  isProcessingMacro: boolean;
  processingActionId?: string | null;
  executions: ExecutionItem[]; 
  
  // Ações
  onOpenMacroModal: (macro?: any) => void;
  onOpenSequenceModal: (item?: any, mode?: 'script'|'funnel') => void;
  onOpenScheduleModal: (item: any, type: 'macro' | 'funnel') => void;
  onRunFunnel: (funnel: Funnel) => void;
  onRunScriptStep: (step: any, scriptTitle: string) => void;
  onMacroSend: (macro: Macro) => void;
  onDelete: (id: number, table: 'macros' | 'funnels') => void;
  onEditSchedule: (sched: ScheduledMessage) => void;
  onCancelSchedule: (id: number) => void;
  // Badge de sugestões da Clara
  claraSuggestionCount?: number;
  onClaraBadgeClick?: () => void;
  // Módulo ativo (para o copiloto usar o agente correto)
  module?: "pediatria" | "atendimento";
}

export default function ChatSidebar({
  activeTab,
  setActiveTab,
  chatId,
  patientName,
  macros,
  funnels,
  scheduledMessages,
  searchTerm,
  setSearchTerm,
  expandedItemId,
  setExpandedItemId,
  isProcessingMacro,
  processingActionId,
  executions,
  onOpenMacroModal,
  onOpenSequenceModal,
  onOpenScheduleModal,
  onRunFunnel,
  onRunScriptStep,
  onMacroSend,
  onDelete,
  onEditSchedule,
  onCancelSchedule,
  claraSuggestionCount = 0,
  onClaraBadgeClick,
  module
}: ChatSidebarProps) {
  const [selectedScriptId, setSelectedScriptId] = useState<number | null>(null);

  const toggleExpand = (id: number | string) => { 
      setExpandedItemId(expandedItemId === id ? null : id); 
  };

  const handleTabClick = (tab: typeof activeTab) => { 
      if (activeTab === tab) setActiveTab(null); 
      else { setActiveTab(tab); setExpandedItemId(null); } 
  };

  const filteredScripts = useMemo(
    () =>
      funnels.filter(
        (f) =>
          (f as any).type === 'script' &&
          (!searchTerm || f.title.toLowerCase().includes(searchTerm.toLowerCase()))
      ),
    [funnels, searchTerm]
  );

  const selectedScript =
    filteredScripts.find((script) => script.id === selectedScriptId) || filteredScripts[0] || null;

  useEffect(() => {
    if (activeTab !== 'script') return;
    if (!filteredScripts.length) {
      setSelectedScriptId(null);
      return;
    }
    if (!selectedScriptId || !filteredScripts.some((script) => script.id === selectedScriptId)) {
      setSelectedScriptId(filteredScripts[0].id);
    }
  }, [activeTab, filteredScripts, selectedScriptId]);

  // Ícone auxiliar para renderizar botões da sidebar
  const renderSidebarIcon = ({ id, icon: Icon, label, colorClass, spin = false, count = 0 }: any) => {
      const isActive = activeTab === id;
      return (
          <div className="relative group">
              <button
                  onClick={() => handleTabClick(id)}
                  aria-label={label}
                  className={`relative w-9 h-9 flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200
                    ${isActive
                        ? `${colorClass} text-white shadow-md`
                        : 'text-gray-400 dark:text-[#71717a] hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-600 dark:hover:text-gray-300'
                    }`}
              >
                  <Icon size={18} className={spin ? 'animate-spin' : ''}/>

                  {/* Badge de Contagem */}
                  {count > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-white dark:ring-[#08080b]">
                          {count}
                      </span>
                  )}
              </button>

              {/* Tooltip Lateral */}
              <div className="absolute right-full top-1/2 -translate-y-1/2 mr-3 px-2.5 py-1.5 bg-gray-900 dark:bg-[#2d2d36] text-white text-[11px] font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
                  {label}
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 -mr-1 border-4 border-transparent border-l-gray-900 dark:border-l-gray-700"/>
              </div>
          </div>
      );
  };

  return (
      <div className="flex h-full bg-white dark:bg-[#08080b] border-l border-gray-200 dark:border-[#2d2d36] shadow-xl z-30 transition-all duration-300 overflow-hidden">
        
        {/* --- PAINEL EXPANSÍVEL (CONTEÚDO) --- */}
        <div className={`flex flex-col bg-gray-50/50 dark:bg-[#111b21] transition-all duration-300 ease-in-out border-r border-gray-100 dark:border-[#2d2d36] overflow-hidden ${activeTab ? 'w-[calc(100vw-58px)] sm:w-[360px] opacity-100' : 'w-0 opacity-0'}`}>
            
            {activeTab && (
                <div className="flex flex-col h-full w-full"> 
                    
                    {/* Header do Painel */}
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-[#3d3d48] bg-white dark:bg-[#202c33] flex justify-between items-center shrink-0 transition-colors">
                        <div className="flex items-center gap-2.5">
                          {activeTab === 'text' && <div className="p-1.5 rounded-lg bg-[var(--chat-accent)]/10"><FileText size={16} className="text-[var(--chat-accent)]"/></div>}
                          {activeTab === 'audio' && <div className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-900/20"><Mic size={16} className="text-purple-500"/></div>}
                          {activeTab === 'image' && <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20"><ImageIcon size={16} className="text-emerald-500"/></div>}
                          {activeTab === 'script' && <div className="p-1.5 rounded-lg bg-orange-50 dark:bg-orange-900/20"><Scroll size={16} className="text-orange-500"/></div>}
                          {activeTab === 'funnels' && <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20"><Workflow size={16} className="text-indigo-500"/></div>}
                          {activeTab === 'schedule' && <div className="p-1.5 rounded-lg bg-cyan-50 dark:bg-cyan-900/20"><CalendarClock size={16} className="text-cyan-500"/></div>}
                          {activeTab === 'executions' && <div className="p-1.5 rounded-lg bg-cyan-50 dark:bg-cyan-900/20"><Orbit size={16} className="text-cyan-500"/></div>}
                          {activeTab === 'copiloto' && <div className="p-1.5 rounded-lg bg-violet-50 dark:bg-violet-900/20"><BotMessageSquare size={16} className="text-violet-500"/></div>}
                          <div>
                            <h3 className="font-semibold text-gray-800 dark:text-[#fafafa] text-[13px]">
                                {activeTab === 'text' && 'Mensagens Rápidas'}
                                {activeTab === 'audio' && 'Biblioteca de Áudio'}
                                {activeTab === 'image' && 'Mídia e Arquivos'}
                                {activeTab === 'script' && 'Scripts de Venda'}
                                {activeTab === 'funnels' && 'Funis Automáticos'}
                                {activeTab === 'schedule' && 'Agenda de Envios'}
                                {activeTab === 'executions' && 'Centro de Execução'}
                                {activeTab === 'copiloto' && 'Copiloto IA'}
                            </h3>
                            <p className="text-[10px] text-gray-400 dark:text-[#71717a]">Ctrl/Cmd+K para abrir</p>
                          </div>
                        </div>
                        <button onClick={() => setActiveTab(null)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer">
                            <ChevronsRight size={16}/>
                        </button>
                    </div>

                    {/* Barra de Busca */}
                    {activeTab !== 'schedule' && activeTab !== 'executions' && activeTab !== 'copiloto' && (
                        <div className="px-4 py-3 bg-white dark:bg-[#202c33] border-b border-gray-100 dark:border-[#3d3d48] transition-colors">
                            <div className="relative group">
                                <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4 group-focus-within:text-[var(--chat-accent)] transition-colors" />
                                <input 
                                    value={searchTerm} 
                                    onChange={e => setSearchTerm(e.target.value)} 
                                    placeholder="Pesquisar..." 
                                    className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-[#1c1c21] border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[var(--chat-accent)] focus:bg-white dark:focus:bg-[#2a2d36] transition-all" 
                                />
                            </div>
                        </div>
                    )}

                    {/* --- ABA COPILOTO (sem padding extra, ocupa todo o espaço) --- */}
                    {activeTab === 'copiloto' && (
                        <div className="flex-1 overflow-hidden">
                            <CopilotChat chatId={chatId} patientName={patientName} module={module} />
                        </div>
                    )}

                    {/* --- CONTEÚDO SCROLLÁVEL (demais abas) --- */}
                    {activeTab !== 'copiloto' && (
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-gray-50/50 dark:bg-[#111b21] transition-colors">

                        {/* 1. LISTA DE EXECUÇÕES */}
                        {activeTab === 'executions' && (
                            <div className="space-y-3">
                                {executions.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                                        <div className="w-14 h-14 bg-cyan-50 dark:bg-cyan-900/20 rounded-2xl flex items-center justify-center mb-3">
                                            <Orbit size={26} className="text-cyan-500 dark:text-cyan-400" />
                                        </div>
                                        <p className="text-sm font-medium text-gray-600 dark:text-[#d4d4d8]">Nenhuma execução ativa</p>
                                        <p className="text-xs text-gray-400 dark:text-[#71717a] mt-1 text-center max-w-[220px]">Envios de funis e macros aparecem aqui em tempo real.</p>
                                    </div>
                                ) : (
                                    executions.map((exec) => (
                                        <div key={exec.id} className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-3 rounded-2xl border border-cyan-500/20 shadow-lg shadow-cyan-900/20 relative overflow-hidden animate-in slide-in-from-right-2">
                                            <div className="absolute inset-0 opacity-30 pointer-events-none">
                                                <div className="absolute -top-8 -right-8 w-20 h-20 rounded-full bg-cyan-400/20 blur-2xl" />
                                                <div className="absolute -bottom-8 -left-8 w-20 h-20 rounded-full bg-sky-400/20 blur-2xl" />
                                            </div>
                                            <div className="relative flex justify-between items-start mb-2">
                                                <div className="min-w-0">
                                                    <span className="font-bold text-gray-100 text-xs truncate block max-w-[190px]">{exec.title}</span>
                                                    <span className="text-[10px] text-cyan-200/80 flex items-center gap-1 mt-0.5">
                                                        <Sparkles size={10} />
                                                        Pipeline de automação
                                                    </span>
                                                </div>
                                                <span className="text-[10px] uppercase font-bold text-cyan-100 bg-cyan-500/20 border border-cyan-400/30 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                                                    {exec.status === 'queued' && <CircleDashed size={10} className="animate-spin" />}
                                                    {exec.status === 'sending' && <Loader2 size={10} className="animate-spin" />}
                                                    {exec.status === 'sent' && <Send size={10}/>}
                                                    {exec.status === 'delivered' && <Send size={10}/>}
                                                    {exec.status === 'read' && <Send size={10}/>}
                                                    {exec.status === 'failed' && <Trash2 size={10}/>}
                                                    {exec.status === 'queued' && 'Na fila'}
                                                    {exec.status === 'sending' && 'Enviando'}
                                                    {exec.status === 'sent' && 'Enviado'}
                                                    {exec.status === 'delivered' && 'Entregue'}
                                                    {exec.status === 'read' && 'Lido'}
                                                    {exec.status === 'failed' && 'Falhou'}
                                                </span>
                                            </div>
                                            
                                            <div className="relative w-full bg-slate-700/60 rounded-full h-2 overflow-hidden mb-1 border border-slate-600/60">
                                                <div 
                                                    className={`h-full transition-all duration-500 ${
                                                      exec.status === 'failed'
                                                        ? 'bg-gradient-to-r from-red-500 to-rose-500'
                                                        : exec.status === 'read'
                                                        ? 'bg-gradient-to-r from-emerald-400 to-green-400'
                                                        : 'bg-gradient-to-r from-cyan-400 to-sky-400'
                                                    }`}
                                                    style={{ width: `${exec.progress}%` }}
                                                />
                                            </div>
                                            <div className="relative flex justify-between items-center">
                                                <p className="text-[10px] text-cyan-100/80">
                                                  {(exec.data?.stepsCount || 1)} etapa(s)
                                                </p>
                                                <p className="text-[10px] text-cyan-100 font-semibold">{Math.round(exec.progress)}%</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* 2. MACROS (Texto/Audio/Imagem) */}
                        {['text', 'audio', 'image'].includes(activeTab) && (
                            macros.filter(m => {
                                const sameType =
                                  activeTab === 'image'
                                    ? m.type === 'image' || m.type === 'video' || m.type === 'document'
                                    : m.type === activeTab;
                                return sameType && (!searchTerm || m.title.toLowerCase().includes(searchTerm.toLowerCase()));
                            })
                            .map(macro => (
                                <div key={macro.id} className="bg-white dark:bg-[#1c1c21] rounded-xl border border-gray-200 dark:border-[#3d3d48] p-3 hover:shadow-sm hover:border-gray-300 dark:hover:border-gray-600 transition-all group cursor-pointer" onClick={() => toggleExpand(macro.id)}>
                                    {(() => {
                                      const isMacroSending = isProcessingMacro && processingActionId === `macro:${macro.id}`;
                                      return (
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5 overflow-hidden">
                                            <div
                                                className={`p-1.5 rounded-lg shrink-0 ${activeTab === 'text' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-500 dark:text-blue-300' : activeTab === 'audio' ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-500 dark:text-purple-300' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 dark:text-emerald-300'}`}
                                            >
                                                {activeTab === 'text'
                                                  ? <FileText size={15}/>
                                                  : activeTab === 'audio'
                                                  ? <Mic size={15}/>
                                                  : <ImageIcon size={15}/>}
                                            </div>
                                            <div className="flex flex-col truncate">
                                                <span className="font-semibold text-[13px] text-gray-700 dark:text-[#fafafa] truncate">{macro.title}</span>
                                                <span className="text-[10px] text-gray-400 dark:text-[#71717a] flex items-center gap-1"><Clock size={9}/> {macro.simulation_delay || 3}s</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onMacroSend(macro); }}
                                                disabled={isProcessingMacro && !isMacroSending}
                                                className="px-2.5 py-1.5 bg-[var(--chat-accent)] hover:bg-[var(--chat-accent-hover)] text-white text-[10px] font-semibold rounded-lg flex items-center gap-1 shadow-sm dark:shadow-none transition-colors cursor-pointer active:scale-95"
                                                title="Enviar agora"
                                            >
                                                {isMacroSending ? <Loader2 size={12} className="animate-spin"/> : <Send size={12}/>} Enviar
                                            </button>
                                            <button onClick={(e) => {e.stopPropagation(); onOpenMacroModal(macro)}} className="p-1.5 text-gray-400 hover:text-[var(--chat-accent)] hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg cursor-pointer transition-colors" aria-label="Editar"><Edit2 size={13}/></button>
                                            <button onClick={(e) => {e.stopPropagation(); onDelete(macro.id, 'macros')}} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg cursor-pointer transition-colors" aria-label="Excluir"><Trash2 size={13}/></button>
                                        </div>
                                    </div>
                                      );
                                    })()}
                                    
                                    {expandedItemId === macro.id && (
                                        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-[#3d3d48] animate-in slide-in-from-top-1">
                                            <div className="mb-3">
                                                {activeTab === 'text' ? (
                                                    <p className="text-xs text-gray-600 dark:text-[#d4d4d8] bg-gray-50 dark:bg-[#202c33] p-2 rounded-lg border border-gray-100 dark:border-gray-600 leading-relaxed">
                                                        {macro.content}
                                                    </p>
                                                ) : activeTab === 'audio' ? (
                                                    <div className="bg-gray-50 dark:bg-[#202c33] p-2 rounded-lg border border-gray-100 dark:border-gray-600">
                                                        <AudioMessage src={macro.content} simpleMode={true} />
                                                    </div>
                                                ) : macro.type === 'video' ? (
                                                    <video src={macro.content} controls className="w-full h-auto object-cover max-h-32 bg-black"/>
                                                ) : macro.type === 'document' ? (
                                                    <a href={macro.content} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">
                                                        Abrir documento
                                                    </a>
                                                ) : (
                                                    <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600">
                                                        <img src={macro.content} alt="Preview" className="w-full h-auto object-cover max-h-32"/>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => onOpenScheduleModal(macro, 'macro')} className="flex-1 bg-white dark:bg-[#202c33] border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-600 dark:text-gray-200 text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-2 transition-colors">
                                                    <CalendarClock size={14}/> Agendar
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}

                        {/* 3. SCRIPTS */}
                        {activeTab === 'script' && (
                          <div className="space-y-3">
                            {filteredScripts.length === 0 ? (
                              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                                <div className="w-14 h-14 bg-orange-50 dark:bg-orange-900/20 rounded-2xl flex items-center justify-center mb-3">
                                  <Scroll size={24} className="text-orange-400 dark:text-orange-300" />
                                </div>
                                <p className="text-sm font-medium text-gray-600 dark:text-[#d4d4d8]">Nenhum script encontrado</p>
                                <p className="text-xs text-gray-400 dark:text-[#71717a] mt-1 text-center max-w-[220px]">Crie um script para usar como playbook de atendimento.</p>
                              </div>
                            ) : (
                              <>
                                <div className="bg-white dark:bg-[#1c1c21] rounded-xl border border-gray-200 dark:border-[#3d3d48] p-3">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Script ativo</span>
                                  </div>
                                  <select
                                    value={selectedScript?.id ?? ''}
                                    onChange={(e) => setSelectedScriptId(Number(e.target.value))}
                                    className="w-full text-xs bg-gray-50 dark:bg-[#202c33] border border-gray-200 dark:border-gray-600 rounded-lg px-2.5 py-2 text-gray-700 dark:text-gray-200 outline-none focus:border-orange-500"
                                  >
                                    {filteredScripts.map((script) => (
                                      <option key={script.id} value={script.id}>
                                        {script.title}
                                      </option>
                                    ))}
                                  </select>
                                  <div className="mt-3 flex gap-2">
                                    <button
                                      onClick={() => selectedScript && onOpenSequenceModal(selectedScript, 'script')}
                                      className="flex-1 bg-white dark:bg-[#202c33] border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-600 dark:text-[#d4d4d8] text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
                                    >
                                      <Edit2 size={12} /> Editar
                                    </button>
                                    <button
                                      onClick={() => selectedScript && onDelete(selectedScript.id, 'funnels')}
                                      className="px-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-300 text-xs font-bold py-2 rounded-lg transition-colors"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>

                                {selectedScript && (
                                  <div className="bg-white dark:bg-[#1c1c21] rounded-xl border border-gray-200 dark:border-[#3d3d48] p-3">
                                    <div className="mb-3">
                                      <h4 className="font-bold text-sm text-gray-700 dark:text-[#fafafa]">{selectedScript.title}</h4>
                                      <p className="text-[10px] text-gray-500 dark:text-[#a1a1aa]">
                                        Preview completo com envio manual por etapa.
                                      </p>
                                    </div>

                                    <div className="space-y-2 max-h-[46vh] overflow-y-auto pr-1 custom-scrollbar">
                                      {(selectedScript.steps || []).map((step: any, idx: number) => {
                                        const isWaitStep = step.type === 'wait';
                                        const isFunnelStep = step.type === 'funnel';
                                        const preview =
                                          isFunnelStep
                                            ? `[Funil] ${step.title || 'Sem nome'}`
                                            : step.type === 'text'
                                            ? String(step.content || '').trim() || 'Mensagem de texto'
                                            : step.type === 'image'
                                            ? '[Imagem]'
                                            : step.type === 'audio'
                                            ? '[Áudio]'
                                            : step.type === 'video'
                                            ? '[Vídeo]'
                                            : step.type === 'document'
                                            ? '[Documento]'
                                            : '[Espera]';

                                        return (
                                          <div
                                            key={`${selectedScript.id}-${idx}`}
                                            className="bg-gray-50 dark:bg-[#202c33] p-2.5 rounded-lg border border-gray-100 dark:border-[#3d3d48]"
                                          >
                                            <div className="flex items-start gap-2.5">
                                              <div className="w-5 h-5 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                                                {idx + 1}
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 mb-1">
                                                  <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 font-bold">
                                                    {step.type}
                                                  </span>
                                                  {typeof step.delay === 'number' && step.delay > 0 && (
                                                    <span className="text-[9px] text-gray-500 dark:text-[#a1a1aa]">
                                                      +{step.delay}s
                                                    </span>
                                                  )}
                                                </div>
                                                <p className="text-xs text-gray-600 dark:text-[#d4d4d8] whitespace-pre-wrap break-words">
                                                  {preview}
                                                </p>
                                                {isFunnelStep && Array.isArray(step.funnel_steps) && step.funnel_steps.length > 0 && (
                                                  <div className="mt-1.5 space-y-1">
                                                    {step.funnel_steps.slice(0, 3).map((nested: any, nestedIdx: number) => (
                                                      <p key={nestedIdx} className="text-[11px] text-gray-500 dark:text-[#a1a1aa] truncate">
                                                        {nestedIdx + 1}. {nested.type === 'text' ? (nested.content || 'Texto') : `[${nested.type}]`}
                                                      </p>
                                                    ))}
                                                    {step.funnel_steps.length > 3 && (
                                                      <p className="text-[11px] text-gray-400">
                                                        + {step.funnel_steps.length - 3} etapas
                                                      </p>
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                              <button
                                                onClick={() => !isWaitStep && onRunScriptStep(step, selectedScript.title)}
                                                disabled={isProcessingMacro || isWaitStep}
                                                className="text-[10px] bg-white dark:bg-[#08080b] border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-[#d4d4d8] hover:text-orange-600 dark:hover:text-orange-400 hover:border-orange-200 dark:hover:border-orange-700 px-2.5 py-1.5 rounded shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                              >
                                                {isProcessingMacro && processingActionId === `script:${selectedScript.title}:${step?.title || step?.type || 'step'}`
                                                  ? <span className="inline-flex items-center gap-1"><Loader2 size={10} className="animate-spin"/> Enviando</span>
                                                  : (isWaitStep ? 'Aguardar' : isFunnelStep ? 'Iniciar funil' : 'Enviar')}
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}

                        {/* 4. FUNIS */}
                        {activeTab === 'funnels' && (
                            funnels.filter(f => (f as any).type === 'funnel' || !(f as any).type)
                            .map(funnel => (
                                <div key={funnel.id} className="bg-white dark:bg-[#1c1c21] rounded-xl border border-gray-200 dark:border-[#3d3d48] p-3 hover:shadow-sm hover:border-gray-300 dark:hover:border-gray-600 transition-all group">
                                    <div className="flex justify-between items-center mb-2.5">
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 dark:text-indigo-300 rounded-lg"><Workflow size={16}/></div>
                                            <div>
                                                <h3 className="font-semibold text-[13px] text-gray-800 dark:text-[#fafafa]">{funnel.title}</h3>
                                                <p className="text-[10px] text-gray-400 dark:text-[#71717a]">{(funnel.steps as any[]).length} passos automáticos</p>
                                            </div>
                                        </div>
                                        <button onClick={() => onDelete(funnel.id, 'funnels')} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all cursor-pointer" aria-label="Excluir"><Trash2 size={13}/></button>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => onOpenSequenceModal(funnel, 'funnel')} className="flex-1 bg-white dark:bg-[#202c33] text-gray-600 dark:text-[#d4d4d8] text-[11px] font-semibold py-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-white/5 flex items-center justify-center gap-1.5 transition-colors cursor-pointer">
                                            <Edit2 size={11}/> Editar
                                        </button>
                                        <button onClick={() => onRunFunnel(funnel)} disabled={isProcessingMacro} className="flex-1 bg-indigo-600 text-white text-[11px] font-semibold py-2 rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-1.5 shadow-sm shadow-indigo-200/50 dark:shadow-none transition-colors cursor-pointer active:scale-95">
                                            {isProcessingMacro && processingActionId === `funnel:${funnel.id}` ? <Loader2 size={12} className="animate-spin"/> : <Play size={12}/>} Iniciar
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}

                        {/* 5. AGENDA */}
                        {activeTab === 'schedule' && (
                            <>
                                <div className="pb-3 sticky top-0 z-10">
                                    <button onClick={() => onOpenScheduleModal(null, 'macro')} className="w-full bg-[var(--chat-accent)] hover:bg-[var(--chat-accent-hover)] text-white py-2.5 rounded-xl text-[13px] font-semibold shadow-sm dark:shadow-none flex items-center justify-center gap-2 transition-colors cursor-pointer active:scale-[0.98]">
                                        <Plus size={16}/> Novo Agendamento
                                    </button>
                                </div>
                                <div className="space-y-2.5 pb-10">
                                    {scheduledMessages.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                                            <div className="w-14 h-14 bg-cyan-50 dark:bg-cyan-900/20 rounded-2xl flex items-center justify-center mb-3">
                                                <CalendarClock size={24} className="text-cyan-400 dark:text-cyan-300" />
                                            </div>
                                            <p className="text-sm font-medium text-gray-600 dark:text-[#d4d4d8]">Nenhum agendamento</p>
                                            <p className="text-xs text-gray-400 dark:text-[#71717a] mt-1 text-center max-w-[220px]">Agende mensagens para envio automático.</p>
                                        </div>
                                    ) : scheduledMessages.map(sched => (
                                        <div key={sched.id} className="bg-white dark:bg-[#1c1c21] p-3 rounded-xl border border-gray-200 dark:border-[#3d3d48] hover:shadow-sm transition-all relative overflow-hidden group">
                                            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[var(--chat-accent)]"/>
                                            <div className="flex justify-between items-start mb-1.5 pl-2">
                                                <span className="font-semibold text-gray-700 dark:text-[#fafafa] text-[12px] truncate max-w-[200px]">{sched.title || 'Agendamento'}</span>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                                                    <button onClick={() => onEditSchedule(sched)} className="text-gray-300 hover:text-cyan-500 transition-colors cursor-pointer" aria-label="Editar"><Edit2 size={13}/></button>
                                                    <button onClick={() => onCancelSchedule(sched.id)} className="text-gray-300 hover:text-red-500 transition-colors cursor-pointer" aria-label="Cancelar"><Trash2 size={13}/></button>
                                                </div>
                                            </div>
                                            <div className="pl-2 flex items-center gap-2 text-[10px] text-gray-500 dark:text-[#a1a1aa] mb-2">
                                                <CalendarClock size={11}/>
                                                <span className="font-medium bg-gray-50 dark:bg-white/5 px-1.5 py-0.5 rounded text-[10px]">{new Date(sched.scheduled_for).toLocaleDateString('pt-BR')} às {new Date(sched.scheduled_for).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</span>
                                            </div>
                                            <div className="pl-2">
                                                <span className={`text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full border ${(sched as any).item_type === 'adhoc' ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300 border-purple-100 dark:border-purple-800' : 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-300 border-cyan-100 dark:border-cyan-800'}`}>
                                                    {(sched as any).item_type === 'adhoc' ? 'Personalizado' : (sched as any).item_type === 'macro' ? 'Mensagem Salva' : 'Funil'}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                    )} {/* fim: activeTab !== 'copiloto' */}

                    {/* Footer do Painel (Botão Criar para templates) */}
                    {['text', 'audio', 'image', 'script', 'funnels'].includes(activeTab ?? '') && (
                        <div className="p-3 border-t border-gray-100 dark:border-[#2d2d36] bg-white dark:bg-[#202c33] shrink-0 transition-colors">
                            <button
                                onClick={() => {
                                    if(activeTab === 'script' || activeTab === 'funnels') {
                                        onOpenSequenceModal(null, activeTab === 'funnels' ? 'funnel' : 'script');
                                    }
                                    else onOpenMacroModal();
                                }}
                                className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-2.5 rounded-xl text-[13px] font-semibold hover:bg-gray-800 dark:hover:bg-gray-100 flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer active:scale-[0.98]"
                            >
                                <Plus size={15}/> Criar Novo
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* --- ÍCONES LATERAIS (NAVBAR) --- */}
        <div className="w-[52px] sm:w-[58px] flex flex-col items-center py-3 sm:py-4 gap-1.5 bg-white dark:bg-[#08080b] z-40 border-l border-gray-100 dark:border-[#2d2d36] transition-colors">

            {/* Toggle */}
            <button
                onClick={() => setActiveTab(activeTab ? null : 'text')}
                className="p-1.5 text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400 transition-colors cursor-pointer mb-1"
                title={activeTab ? "Fechar Menu" : "Abrir Menu"}
                aria-label={activeTab ? "Fechar Menu" : "Abrir Menu"}
            >
                {activeTab ? <ChevronsRight size={18}/> : <Menu size={18}/>}
            </button>

            {/* Execução (destaque) */}
            {renderSidebarIcon({
                id: "executions",
                icon: Orbit,
                label: "Centro de Execução",
                colorClass: "bg-cyan-600",
                spin: executions.length > 0,
                count: executions.length,
            })}

            <div className="w-6 h-px bg-gray-100 dark:bg-[#2d2d36] my-1"/>

            {/* Grupo: Conteúdo */}
            <span className="text-[8px] font-bold uppercase tracking-widest text-gray-300 dark:text-gray-600 mb-0.5">Envio</span>
            {renderSidebarIcon({ id:"text", icon:FileText, label:"Mensagens", colorClass:"bg-[var(--chat-accent)]" })}
            {renderSidebarIcon({ id:"audio", icon:Mic, label:"Áudios", colorClass:"bg-purple-600" })}
            {renderSidebarIcon({ id:"image", icon:ImageIcon, label:"Mídia", colorClass:"bg-emerald-600" })}

            <div className="w-6 h-px bg-gray-100 dark:bg-[#2d2d36] my-1"/>

            {/* Grupo: Automação */}
            <span className="text-[8px] font-bold uppercase tracking-widest text-gray-300 dark:text-gray-600 mb-0.5">Auto</span>
            {renderSidebarIcon({ id:"script", icon:Scroll, label:"Scripts", colorClass:"bg-orange-500" })}
            {renderSidebarIcon({ id:"funnels", icon:Workflow, label:"Funis", colorClass:"bg-indigo-600" })}
            {renderSidebarIcon({ id:"schedule", icon:CalendarClock, label:"Agenda", colorClass:"bg-cyan-600" })}

            <div className="flex-1" />

            {/* Badge de sugestões da Clara */}
            {claraSuggestionCount > 0 && (
              <div className="relative group mb-1">
                <button
                  onClick={onClaraBadgeClick}
                  aria-label="Sugestões da Clara"
                  className="relative w-9 h-9 flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200
                    hover:bg-purple-50 dark:hover:bg-purple-900/20 animate-in zoom-in duration-200"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm animate-pulse">
                    <Bot size={14} className="text-white" />
                  </div>
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-white dark:ring-[#08080b]">
                    {claraSuggestionCount}
                  </span>
                </button>
                <div className="absolute right-full top-1/2 -translate-y-1/2 mr-3 px-2.5 py-1.5 bg-gray-900 dark:bg-[#2d2d36] text-white text-[11px] font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
                  Sugestões da Clara
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 -mr-1 border-4 border-transparent border-l-gray-900 dark:border-l-gray-700"/>
                </div>
              </div>
            )}

            {/* IA (fixo no fundo) */}
            {renderSidebarIcon({ id: "copiloto", icon: BotMessageSquare, label: "Copiloto IA", colorClass: "bg-violet-600" })}
        </div>
      </div>
  );
}