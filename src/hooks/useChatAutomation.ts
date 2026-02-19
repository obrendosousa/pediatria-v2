import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import { Chat, Macro, Funnel, ScheduledMessage } from '@/types';
import { useToast } from '@/contexts/ToastContext';

export interface ExecutionItem {
  id: string; 
  chatId: number;
  title: string;
  type: 'text' | 'audio' | 'image' | 'video' | 'document' | 'wait';
  status: 'queued' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  progress: number; 
  totalDuration: number; 
  data: any; 
}

export function useChatAutomation(activeChat: Chat | null) {
  const { toast } = useToast();
  const [macros, setMacros] = useState<Macro[]>([]);
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>([]);
  
  // CORREÇÃO AQUI: Adicionado 'executions' ao tipo do estado - Inicia minimizado (null)
  const [activeTab, setActiveTab] = useState<'text' | 'audio' | 'image' | 'script' | 'funnels' | 'schedule' | 'executions' | null>(null); 
  
  const [isProcessingMacro, setIsProcessingMacro] = useState(false);
  const [processingActionId, setProcessingActionId] = useState<string | null>(null);
  const [executions, setExecutions] = useState<ExecutionItem[]>([]);

  // 1. Carregar Dados Iniciais
  const fetchData = async () => {
      const { data: m } = await supabase.from('macros').select('*').order('title');
      const { data: f } = await supabase.from('funnels').select('*').order('title');
      if (m) setMacros(m);
      if (f) setFunnels(f);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 2. Carregar Agendamentos
  const fetchScheduledMessages = async () => {
      if (!activeChat) return;
      const { data } = await supabase.from('scheduled_messages')
        .select('*')
        .eq('chat_id', activeChat.id)
        .eq('status', 'pending')
        .order('scheduled_for', { ascending: true });
      if (data) setScheduledMessages(data as ScheduledMessage[]);
  };

  useEffect(() => { 
      if (activeTab === 'schedule') fetchScheduledMessages(); 
  }, [activeTab, activeChat?.id]);


  // 3. Motor de Execução (server-side via LangGraph)
  const runServerFunnel = async (
    title: string,
    steps: Array<{ type: 'text' | 'audio' | 'image' | 'document' | 'video' | 'wait'; content?: string; delay?: number }>
  ) => {
    if (!activeChat) return;
    const runStartedAt = new Date().toISOString();
    const totalConfiguredDelaySec = Math.max(
      steps.reduce((acc, step) => acc + Math.max(step.delay || 0, 0), 0),
      2
    );
    const expectedOutgoingMessages = Math.max(steps.filter((step) => step.type !== 'wait').length, 1);

    const execId = Math.random().toString(36).slice(2, 11);
    const firstType = steps[0]?.type ?? 'text';
    setExecutions(prev => [
      ...prev,
      {
        id: execId,
        chatId: activeChat.id,
        title,
        type: firstType as any,
        status: 'queued',
        progress: 0,
        totalDuration: totalConfiguredDelaySec,
        data: { stepsCount: steps.length, startedAt: runStartedAt },
      },
    ]);

    const progressStartMs = Date.now();
    let progressTimer: ReturnType<typeof setInterval> | null = null;
    let stopped = false;
    const stopProgressTimer = () => {
      if (progressTimer) {
        clearInterval(progressTimer);
        progressTimer = null;
      }
    };

    setExecutions(prev => prev.map(e => (e.id === execId ? { ...e, status: 'sending', progress: 0 } : e)));

    progressTimer = setInterval(() => {
      if (stopped) return;
      const elapsedSec = (Date.now() - progressStartMs) / 1000;
      // Não deixa bater 100% antes da mensagem realmente aparecer no chat
      const linearProgress = Math.min(95, (elapsedSec / totalConfiguredDelaySec) * 95);
      setExecutions(prev =>
        prev.map(e =>
          e.id === execId
            ? { ...e, progress: linearProgress, status: e.status === 'queued' ? 'sending' : e.status }
            : e
        )
      );
    }, 120);

    try {
      const response = await fetch('/api/automation/funnel/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: activeChat.id,
          phone: activeChat.phone,
          title,
          steps,
          initiatedBy: 'ui',
        }),
      });

      const json = await response.json();
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error?.message || 'Falha ao executar funil no servidor');
      }

      // A simulação só termina ao aparecer a(s) mensagem(ns) no chat
      let appearedInChat = false;
      for (let attempt = 0; attempt < 25; attempt++) {
        const { data: recentInserted } = await supabase
          .from('chat_messages')
          .select('id')
          .eq('chat_id', activeChat.id)
          .eq('sender', 'HUMAN_AGENT')
          .gte('created_at', runStartedAt)
          .order('created_at', { ascending: false })
          .limit(Math.max(expectedOutgoingMessages, 10));

        if ((recentInserted || []).length >= expectedOutgoingMessages) {
          appearedInChat = true;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      stopped = true;
      stopProgressTimer();
      setExecutions(prev =>
        prev.map(e => (
          e.id === execId
            ? { ...e, status: 'sent', progress: appearedInChat ? 100 : Math.max(e.progress, 95) }
            : e
        ))
      );
      // Assim que chega a 100% (mensagem no chat), finaliza rapidamente a execução visual
      setTimeout(() => setExecutions(prev => prev.filter(e => e.id !== execId)), 1200);
    } catch (error) {
      stopped = true;
      stopProgressTimer();
      console.error("Erro na execução server-side", error);
      setExecutions(prev => prev.map(e => (e.id === execId ? { ...e, status: 'failed' } : e)));
      setTimeout(() => setExecutions(prev => prev.filter(e => e.id !== execId)), 3000);
    }
  };

  // --- Ações Públicas ---

  const handleRunFunnel = async (funnel: Funnel) => {
      if (!activeChat || isProcessingMacro) return;
      setIsProcessingMacro(true);
      setProcessingActionId(`funnel:${funnel.id}`);
      // Abre a aba de execuções para dar feedback visual
      setActiveTab('executions'); 
      
      try {
        await runServerFunnel(
          `Funil: ${funnel.title}`,
          funnel.steps.map(step => ({
            type: (step.type === 'funnel' ? 'text' : step.type) as 'text' | 'audio' | 'image' | 'document' | 'video' | 'wait',
            content: step.content || '',
            delay: Math.max(step.delay || 0, 2),
          }))
        );
      } finally {
        setIsProcessingMacro(false);
        setProcessingActionId(null);
      }
  };

  const handleRunScriptStep = async (step: any, scriptTitle: string) => {
      if (!activeChat || isProcessingMacro) return;
      setIsProcessingMacro(true);
      setProcessingActionId(`script:${scriptTitle}:${step?.title || step?.type || 'step'}`);
      setActiveTab('executions');
      try {
          if (step?.type === 'funnel' && Array.isArray(step?.funnel_steps) && step.funnel_steps.length > 0) {
            await runServerFunnel(
              `Script: ${scriptTitle} • Funil: ${step.title || 'Bloco'}`,
              step.funnel_steps.map((nested: any) => ({
                type: (nested.type || 'text') as 'text' | 'audio' | 'image' | 'document' | 'video' | 'wait',
                content: nested.content || '',
                delay: Math.max(nested.delay || 0, 0),
              }))
            );
            return;
          }

          await runServerFunnel(`Script: ${scriptTitle}`, [{
            type: step.type as 'text' | 'audio' | 'image' | 'document' | 'video' | 'wait',
            content: step.content || '',
            delay: 2,
          }]);
      } finally {
        setIsProcessingMacro(false);
        setProcessingActionId(null);
      }
  };

  const handleMacroSend = async (macro: Macro) => {
      if (!activeChat || isProcessingMacro) return;
      setIsProcessingMacro(true);
      setProcessingActionId(`macro:${macro.id}`);
      try { 
          await runServerFunnel(macro.title, [{
            type: macro.type as 'text' | 'audio' | 'image' | 'document' | 'video' | 'wait',
            content: macro.content,
            delay: macro.simulation_delay || 3,
          }]); 
      } finally { 
          setIsProcessingMacro(false); 
          setProcessingActionId(null);
      }
  };

  const handleSaveMacro = async (data: any, editingId?: number) => {
    let error = null;
    if (editingId) {
        const res = await supabase.from('macros').update(data).eq('id', editingId);
        error = res.error;
    } else {
        const res = await supabase.from('macros').insert({ ...data, category: 'Geral' });
        error = res.error;
    }
    if (error) toast.toast.error("Erro ao salvar Macro: " + JSON.stringify(error));
    else fetchData();
  };

  const handleSaveSequence = async (data: any, editingId?: number) => {
      const payload = {
          title: data.title,
          steps: data.steps,
          type: data.type || 'funnel'
      };
      let error = null;
      if (editingId) {
          const res = await supabase.from('funnels').update(payload).eq('id', editingId);
          error = res.error;
      } else {
          const res = await supabase.from('funnels').insert(payload);
          error = res.error;
      }
      if (error) {
          console.error("Erro Supabase:", error);
          toast.toast.error("Erro ao salvar Roteiro: " + error.message);
      } else {
          fetchData();
      }
  };

  const handleDeleteItem = async (id: number, table: 'macros' | 'funnels') => {
      await supabase.from(table).delete().eq('id', id);
      fetchData();
  };

  const handleScheduleItem = async (item: any, type: 'macro' | 'funnel', date: string, time: string) => {
    if (!activeChat) return;
    const scheduledFor = new Date(`${date}T${time}:00`);
    const contentPayload = type === 'macro' 
        ? { type: item.type, content: item.content } 
        : { steps: item.steps };
    
    await supabase.from('scheduled_messages').insert({ 
        chat_id: activeChat.id, 
        item_type: type, 
        item_id: item.id, 
        title: item.title, 
        content: contentPayload, 
        scheduled_for: scheduledFor.toISOString(), 
        status: 'pending' 
    });
    fetchScheduledMessages();
    setActiveTab('schedule');
  };

  const handleScheduleAdHoc = async (type: 'text'|'audio'|'image'|'video'|'document', content: string | File | Blob, date: string, time: string, textCaption?: string) => {
      if (!activeChat) return;

      let finalContent = "";
      
      // Upload se for arquivo
      if (content instanceof File || content instanceof Blob) {
          const ext = type === 'audio' ? 'webm' : content.type.split('/')[1];
          const fileName = `adhoc/${activeChat.id}_${Date.now()}.${ext}`;
          const { error } = await supabase.storage.from('midia').upload(fileName, content);
          
          if (error) { toast.toast.error("Erro ao fazer upload da mídia."); return; }
          
          const { data: { publicUrl } } = supabase.storage.from('midia').getPublicUrl(fileName);
          finalContent = publicUrl;
      } else {
          finalContent = content as string;
      }

      const scheduledFor = new Date(`${date}T${time}:00`);
      const payload: any = { type, content: finalContent };
      if (textCaption) payload.caption = textCaption;

      const { error } = await supabase.from('scheduled_messages').insert({
          chat_id: activeChat.id,
          item_type: 'adhoc',
          title:
            type === 'audio'
              ? 'Áudio Personalizado'
              : type === 'video'
              ? 'Vídeo Personalizado'
              : type === 'document'
              ? 'Documento Personalizado'
              : (textCaption || 'Mensagem Rápida'),
          content: payload,
          scheduled_for: scheduledFor.toISOString(),
          status: 'pending'
      });

      if (error) {
          console.error(error);
          toast.toast.error("Erro ao agendar.");
      } else {
          fetchScheduledMessages();
          setActiveTab('schedule');
      }
  };

  const handleCancelSchedule = async (id: number) => {
      await supabase.from('scheduled_messages').delete().eq('id', id);
      fetchScheduledMessages();
  };

  return {
      macros,
      funnels,
      scheduledMessages,
      activeTab,
      setActiveTab,
      isProcessingMacro,
      processingActionId,
      executions,
      
      handleRunFunnel,
      handleRunScriptStep,
      handleMacroSend,
      handleSaveMacro,
      handleSaveSequence,
      handleDeleteItem,
      handleScheduleItem,
      handleScheduleAdHoc,
      handleCancelSchedule
  };
}