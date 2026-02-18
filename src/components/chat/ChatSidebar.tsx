import { 
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
  Menu
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import AudioMessage from './AudioMessage'; 
import { Macro, Funnel, ScheduledMessage } from '@/types';
import { ExecutionItem } from '@/hooks/useChatAutomation'; 

interface ChatSidebarProps {
  activeTab: 'text' | 'audio' | 'image' | 'script' | 'funnels' | 'schedule' | 'executions' | null;
  setActiveTab: (tab: 'text' | 'audio' | 'image' | 'script' | 'funnels' | 'schedule' | 'executions' | null) => void;
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
  onCancelSchedule: (id: number) => void;
}

export default function ChatSidebar({
  activeTab,
  setActiveTab,
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
  onCancelSchedule
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
                  className={`relative w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-300
                    ${isActive 
                        ? `${colorClass} text-white shadow-lg scale-105` 
                        : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-600 dark:hover:text-gray-300'
                    }`}
              >
                  <Icon size={20} className={`transition-transform duration-500 ${spin ? 'animate-spin' : ''}`}/>
                  
                  {/* Badge de Contagem */}
                  {count > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] text-white ring-2 ring-white dark:ring-[#1e2028]">
                          {count}
                      </span>
                  )}
              </button>
              
              {/* Tooltip Lateral */}
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2 py-1 bg-gray-800 dark:bg-gray-700 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                  {label}
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 -ml-1 border-4 border-transparent border-r-gray-800 dark:border-r-gray-700"/>
              </div>
          </div>
      );
  };

  return (
      <div className="flex h-full bg-white dark:bg-[#1e2028] border-l border-gray-200 dark:border-gray-800 shadow-xl z-30 transition-all duration-300 overflow-hidden">
        
        {/* --- PAINEL EXPANSÍVEL (CONTEÚDO) --- */}
        <div className={`flex flex-col bg-gray-50/50 dark:bg-[#111b21] transition-all duration-300 ease-in-out border-r border-gray-100 dark:border-gray-800 overflow-hidden ${activeTab ? 'w-[calc(100vw-58px)] sm:w-[360px] opacity-100' : 'w-0 opacity-0'}`}>
            
            {activeTab && (
                <div className="flex flex-col h-full w-full"> 
                    
                    {/* Header do Painel */}
                    <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-[#202c33] flex justify-between items-center shrink-0 transition-colors">
                        <div>
                          <h3 className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2 text-sm uppercase tracking-wide">
                              {activeTab === 'text' && <><FileText size={18} className="text-blue-500"/> Mensagens Rápidas</>}
                              {activeTab === 'audio' && <><Mic size={18} className="text-purple-500"/> Biblioteca de Áudio</>}
                              {activeTab === 'image' && <><ImageIcon size={18} className="text-emerald-500"/> Mídia e Arquivos</>}
                              {activeTab === 'script' && <><Scroll size={18} className="text-orange-500"/> Scripts de Venda</>}
                              {activeTab === 'funnels' && <><Workflow size={18} className="text-indigo-500"/> Funis Automáticos</>}
                              {activeTab === 'schedule' && <><CalendarClock size={18} className="text-pink-500"/> Agenda de Envios</>}
                              {activeTab === 'executions' && <><Orbit size={18} className="text-cyan-500"/> Centro de Execução</>}
                          </h3>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">Atalhos: Alt+1..5, Ctrl/Cmd+K</p>
                        </div>
                        <button onClick={() => setActiveTab(null)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                            <ChevronsRight size={18}/>
                        </button>
                    </div>

                    {/* Barra de Busca */}
                    {activeTab !== 'schedule' && activeTab !== 'executions' && (
                        <div className="px-4 py-3 bg-white dark:bg-[#202c33] border-b border-gray-100 dark:border-gray-700 transition-colors">
                            <div className="relative group">
                                <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4 group-focus-within:text-blue-500 transition-colors" />
                                <input 
                                    value={searchTerm} 
                                    onChange={e => setSearchTerm(e.target.value)} 
                                    placeholder="Pesquisar..." 
                                    className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-[#2a2d36] border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-[#2a2d36] transition-all" 
                                />
                            </div>
                        </div>
                    )}

                    {/* --- CONTEÚDO SCROLLÁVEL --- */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-gray-50/50 dark:bg-[#111b21] transition-colors">
                        
                        {/* 1. LISTA DE EXECUÇÕES */}
                        {activeTab === 'executions' && (
                            <div className="space-y-3">
                                {executions.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                                        <div className="w-16 h-16 bg-gradient-to-br from-cyan-100 to-sky-200 dark:from-cyan-900/40 dark:to-sky-900/20 rounded-2xl flex items-center justify-center mb-3 border border-cyan-200/60 dark:border-cyan-700/40">
                                            <Orbit size={30} className="text-cyan-600 dark:text-cyan-300" />
                                        </div>
                                        <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">Nenhuma execução ativa</p>
                                        <p className="text-xs text-gray-400">Quando houver envios, eles aparecem aqui em tempo real.</p>
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
                                <div key={macro.id} className="bg-white dark:bg-[#2a2d36] rounded-xl border border-gray-200 dark:border-gray-700 p-3 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-500 transition-all group">
                                    {/** loading apenas no botão clicado */}
                                    {(() => {
                                      const isMacroSending = isProcessingMacro && processingActionId === `macro:${macro.id}`;
                                      return (
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <button
                                                onClick={() => toggleExpand(macro.id)}
                                                className={`p-2 rounded-lg shrink-0 ${activeTab === 'text' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300' : activeTab === 'audio' ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-300'}`}
                                                title="Ver detalhes"
                                            >
                                                {activeTab === 'text'
                                                  ? <FileText size={16}/>
                                                  : activeTab === 'audio'
                                                  ? <Mic size={16}/>
                                                  : <ImageIcon size={16}/>}
                                            </button>
                                            <div className="flex flex-col truncate">
                                                <span className="font-bold text-sm text-gray-700 dark:text-gray-100 truncate">{macro.title}</span>
                                                <span className="text-[10px] text-gray-400 flex items-center gap-1"><Clock size={10}/> {macro.simulation_delay || 3}s delay</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => onMacroSend(macro)}
                                                disabled={isProcessingMacro && !isMacroSending}
                                                className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded-lg flex items-center gap-1 shadow-sm shadow-blue-200 dark:shadow-none transition-all active:scale-95"
                                                title="Enviar agora"
                                            >
                                                {isMacroSending ? <Loader2 size={12} className="animate-spin"/> : <Send size={12}/>} Enviar
                                            </button>
                                            <button onClick={(e) => {e.stopPropagation(); onOpenMacroModal(macro)}} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"><Edit2 size={14}/></button>
                                            <button onClick={(e) => {e.stopPropagation(); onDelete(macro.id, 'macros')}} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 size={14}/></button>
                                        </div>
                                    </div>
                                      );
                                    })()}
                                    
                                    {expandedItemId === macro.id && (
                                        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 animate-in slide-in-from-top-1">
                                            <div className="mb-3">
                                                {activeTab === 'text' ? (
                                                    <p className="text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-[#202c33] p-2 rounded-lg border border-gray-100 dark:border-gray-600 leading-relaxed">
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
                              <div className="flex flex-col items-center justify-center py-20 text-gray-400 opacity-60">
                                <div className="w-16 h-16 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-3">
                                  <Scroll size={28} />
                                </div>
                                <p className="text-sm font-medium">Nenhum script encontrado.</p>
                                <p className="text-xs">Crie um script para usar como playbook manual.</p>
                              </div>
                            ) : (
                              <>
                                <div className="bg-white dark:bg-[#2a2d36] rounded-xl border border-gray-200 dark:border-gray-700 p-3">
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
                                      className="flex-1 bg-white dark:bg-[#202c33] border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300 text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
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
                                  <div className="bg-white dark:bg-[#2a2d36] rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                                    <div className="mb-3">
                                      <h4 className="font-bold text-sm text-gray-700 dark:text-gray-100">{selectedScript.title}</h4>
                                      <p className="text-[10px] text-gray-500 dark:text-gray-400">
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
                                            className="bg-gray-50 dark:bg-[#202c33] p-2.5 rounded-lg border border-gray-100 dark:border-gray-700"
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
                                                    <span className="text-[9px] text-gray-500 dark:text-gray-400">
                                                      +{step.delay}s
                                                    </span>
                                                  )}
                                                </div>
                                                <p className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap break-words">
                                                  {preview}
                                                </p>
                                                {isFunnelStep && Array.isArray(step.funnel_steps) && step.funnel_steps.length > 0 && (
                                                  <div className="mt-1.5 space-y-1">
                                                    {step.funnel_steps.slice(0, 3).map((nested: any, nestedIdx: number) => (
                                                      <p key={nestedIdx} className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
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
                                                className="text-[10px] bg-white dark:bg-[#1e2028] border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:text-orange-600 dark:hover:text-orange-400 hover:border-orange-200 dark:hover:border-orange-700 px-2.5 py-1.5 rounded shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
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
                                <div key={funnel.id} className="bg-white dark:bg-[#2a2d36] rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-500 transition-all group">
                                    <div className="flex justify-between items-center mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 rounded-lg"><Workflow size={18}/></div>
                                            <div>
                                                <h3 className="font-bold text-sm text-gray-800 dark:text-gray-100">{funnel.title}</h3>
                                                <p className="text-[10px] text-gray-400">{(funnel.steps as any[]).length} passos automáticos</p>
                                            </div>
                                        </div>
                                        <button onClick={() => onDelete(funnel.id, 'funnels')} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14}/></button>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => onOpenSequenceModal(funnel, 'funnel')} className="flex-1 bg-white dark:bg-[#202c33] text-gray-600 dark:text-gray-300 text-xs font-bold py-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-white/5 flex items-center justify-center gap-2 transition-colors">
                                            <Edit2 size={12}/> Editar
                                        </button>
                                        <button onClick={() => onRunFunnel(funnel)} disabled={isProcessingMacro} className="flex-1 bg-indigo-600 text-white text-xs font-bold py-2 rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2 shadow-md shadow-indigo-200 dark:shadow-none transition-all active:scale-95">
                                            {isProcessingMacro && processingActionId === `funnel:${funnel.id}` ? <Loader2 size={12} className="animate-spin"/> : <Play size={12}/>} Iniciar
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}

                        {/* 5. AGENDA */}
                        {activeTab === 'schedule' && (
                            <>
                                <div className="pb-3 sticky top-0 z-10 bg-gray-50/0">
                                    <button onClick={() => onOpenScheduleModal(null, 'macro')} className="w-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white py-3 rounded-xl text-sm font-bold shadow-lg shadow-pink-200 dark:shadow-none flex items-center justify-center gap-2 transition-all active:scale-[0.98]">
                                        <Plus size={18}/> Novo Agendamento
                                    </button>
                                </div>
                                <div className="space-y-3 pb-10">
                                    {scheduledMessages.map(sched => (
                                        <div key={sched.id} className="bg-white dark:bg-[#2a2d36] p-3 rounded-xl border border-pink-100 dark:border-pink-900/30 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-pink-400"/>
                                            <div className="flex justify-between items-start mb-1 pl-2">
                                                <span className="font-bold text-gray-700 dark:text-gray-100 text-xs truncate max-w-[180px]">{sched.title || 'Agendamento'}</span>
                                                <button onClick={() => onCancelSchedule(sched.id)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={14}/></button>
                                            </div>
                                            <div className="pl-2 flex items-center gap-2 text-[10px] text-gray-500 mb-2">
                                                <CalendarClock size={12}/>
                                                <span className="font-medium bg-gray-100 dark:bg-white/5 px-1.5 rounded">{new Date(sched.scheduled_for).toLocaleDateString('pt-BR')} às {new Date(sched.scheduled_for).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</span>
                                            </div>
                                            <div className="pl-2">
                                                <span className={`text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${(sched as any).item_type === 'adhoc' ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300 border-purple-100 dark:border-purple-800' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 border-blue-100 dark:border-blue-800'}`}>
                                                    {(sched as any).item_type === 'adhoc' ? 'Personalizado' : (sched as any).item_type === 'macro' ? 'Mensagem Salva' : 'Funil'}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Footer do Painel (Botão Criar para templates) */}
                    {['text', 'audio', 'image', 'script', 'funnels'].includes(activeTab) && (
                        <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-[#202c33] shrink-0 transition-colors">
                            <button 
                                onClick={() => {
                                    if(activeTab === 'script' || activeTab === 'funnels') {
                                        onOpenSequenceModal(null, activeTab === 'funnels' ? 'funnel' : 'script');
                                    }
                                    else onOpenMacroModal();
                                }} 
                                className="w-full bg-gray-900 dark:bg-white text-white dark:text-black py-3 rounded-xl text-sm font-bold hover:bg-black dark:hover:bg-gray-200 flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98]"
                            >
                                <Plus size={16}/> Criar Novo
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* --- ÍCONES LATERAIS (NAVBAR) --- */}
        <div className="w-[58px] sm:w-[70px] flex flex-col items-center py-4 sm:py-6 gap-4 bg-white dark:bg-[#1e2028] z-40 border-l border-gray-100 dark:border-gray-800 transition-colors">
            
            {/* Toggle de Abertura (Opcional, pois clicar nos ícones já abre) */}
            <button 
                onClick={() => setActiveTab(activeTab ? null : 'text')} 
                className="p-2 text-gray-300 hover:text-gray-600 dark:text-gray-600 dark:hover:text-gray-300 transition-colors mb-2"
                title={activeTab ? "Fechar Menu" : "Abrir Menu"}
            >
                {activeTab ? <ChevronsRight size={20}/> : <Menu size={20}/>}
            </button>

            {/* Grupo: Execução (Destaque) */}
            {renderSidebarIcon({
                id: "executions",
                icon: Orbit,
                label: "Centro de Execução",
                colorClass: "bg-cyan-600",
                spin: executions.length > 0,
                count: executions.length,
            })}

            <div className="w-8 h-[1px] bg-gray-100 dark:bg-gray-700"/>

            {/* Grupo: Recursos */}
            {renderSidebarIcon({ id:"text", icon:FileText, label:"Mensagens", colorClass:"bg-blue-600" })}
            {renderSidebarIcon({ id:"audio", icon:Mic, label:"Áudios", colorClass:"bg-purple-600" })}
            {renderSidebarIcon({ id:"image", icon:ImageIcon, label:"Mídia", colorClass:"bg-emerald-600" })}
            
            <div className="w-8 h-[1px] bg-gray-100 dark:bg-gray-700"/>
            
            {/* Grupo: Automação */}
            {renderSidebarIcon({ id:"script", icon:Scroll, label:"Scripts", colorClass:"bg-orange-500" })}
            {renderSidebarIcon({ id:"funnels", icon:Workflow, label:"Funis", colorClass:"bg-indigo-600" })}
            {renderSidebarIcon({ id:"schedule", icon:CalendarClock, label:"Agenda", colorClass:"bg-pink-600" })}

            <div className="flex-1" />
            <button
                onClick={() => setActiveTab(null)}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition-all text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                title="Fechar painel"
            >
                <ChevronsRight size={18} />
            </button>
        </div>
      </div>
  );
}