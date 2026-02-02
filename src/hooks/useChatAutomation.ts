import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Chat, Macro, Funnel, ScheduledMessage } from '@/types';

export interface ExecutionItem {
  id: string; 
  chatId: number;
  title: string;
  type: 'text' | 'audio' | 'image' | 'video' | 'wait';
  status: 'pending' | 'simulating' | 'sending' | 'completed' | 'failed';
  progress: number; 
  totalDuration: number; 
  data: any; 
}

export function useChatAutomation(activeChat: Chat | null) {
  const [macros, setMacros] = useState<Macro[]>([]);
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>([]);
  
  // CORREÇÃO AQUI: Adicionado 'executions' ao tipo do estado - Inicia minimizado (null)
  const [activeTab, setActiveTab] = useState<'text' | 'audio' | 'image' | 'script' | 'funnels' | 'schedule' | 'executions' | null>(null); 
  
  const [isProcessingMacro, setIsProcessingMacro] = useState(false);
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


  // 3. Motor de Execução
  const executeItem = async (chatId: number, phone: string, type: string, content: string, duration: number, title: string) => {
      const execId = Math.random().toString(36).substr(2, 9);
      const newItem: ExecutionItem = { 
          id: execId, chatId, title, 
          type: type as any, 
          status: 'simulating', 
          progress: 0, 
          totalDuration: duration, 
          data: { content } 
      };
      setExecutions(prev => [...prev, newItem]);

      // Se não estiver na aba de execuções, abre ela automaticamente para o usuário ver o progresso
      if (activeTab !== 'executions') {
          // Opcional: Descomente se quiser que abra a aba automaticamente
          // setActiveTab('executions');
      }

      try {
          if (type !== 'wait') {
              await fetch('/api/whatsapp/presence', { 
                  method: 'POST', 
                  body: JSON.stringify({ 
                      phone, 
                      status: type === 'audio' ? 'recording' : 'composing', 
                      duration: duration * 1000 
                  }) 
              });
          }

          const startTime = Date.now(); 
          const endTime = startTime + (duration * 1000);
          
          await new Promise<void>((resolve) => {
              const timer = setInterval(() => {
                  const now = Date.now(); 
                  const remaining = endTime - now; 
                  const progress = Math.min(100, 100 - (remaining / (duration * 1000) * 100));
                  setExecutions(prev => prev.map(e => e.id === execId ? { ...e, progress } : e));
                  if (now >= endTime) { clearInterval(timer); resolve(); }
              }, 100);
          });

          setExecutions(prev => prev.map(e => e.id === execId ? { ...e, status: 'sending' } : e));
          
          if (type !== 'wait') {
              await fetch('/api/whatsapp/send', { 
                  method: 'POST', 
                  headers: { 'Content-Type': 'application/json' }, 
                  body: JSON.stringify({ 
                      chatId, 
                      phone, 
                      message: type === 'text' ? content : '', 
                      type: type === 'text' ? 'text' : type, 
                      mediaUrl: type !== 'text' ? content : undefined 
                  }), 
              });
          }
          
          setExecutions(prev => prev.filter(e => e.id !== execId)); 
      } catch (error) {
          console.error("Erro na execução", error);
          setExecutions(prev => prev.map(e => e.id === execId ? { ...e, status: 'failed' } : e));
          setTimeout(() => setExecutions(prev => prev.filter(e => e.id !== execId)), 3000); 
      }
  };

  // --- Ações Públicas ---

  const handleRunFunnel = async (funnel: Funnel) => {
      if (!activeChat || isProcessingMacro) return;
      setIsProcessingMacro(true);
      // Abre a aba de execuções para dar feedback visual
      setActiveTab('executions'); 
      
      try {
        for (const step of funnel.steps) {
            const delaySec = (step.delay || 0);
            await executeItem(activeChat.id, activeChat.phone, step.type, step.content || '', Math.max(delaySec, 2), `Funil: ${funnel.title}`);
        }
      } finally { setIsProcessingMacro(false); }
  };

  const handleRunScriptStep = async (step: any, scriptTitle: string) => {
      if (!activeChat || isProcessingMacro) return;
      setIsProcessingMacro(true);
      try {
          await executeItem(activeChat.id, activeChat.phone, step.type, step.content || '', 2, `Script: ${scriptTitle}`);
      } finally { setIsProcessingMacro(false); }
  };

  const handleMacroSend = async (macro: Macro) => {
      if (!activeChat || isProcessingMacro) return;
      setIsProcessingMacro(true);
      try { 
          await executeItem(activeChat.id, activeChat.phone, macro.type, macro.content, macro.simulation_delay || 3, macro.title); 
      } finally { 
          setIsProcessingMacro(false); 
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
    if (error) alert("Erro ao salvar Macro: " + JSON.stringify(error));
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
          alert("Erro ao salvar Roteiro: " + error.message);
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

  const handleScheduleAdHoc = async (type: 'text'|'audio'|'image', content: string | File | Blob, date: string, time: string, textCaption?: string) => {
      if (!activeChat) return;

      let finalContent = "";
      
      // Upload se for arquivo
      if (content instanceof File || content instanceof Blob) {
          const ext = type === 'audio' ? 'webm' : content.type.split('/')[1];
          const fileName = `adhoc/${activeChat.id}_${Date.now()}.${ext}`;
          const { error } = await supabase.storage.from('midia').upload(fileName, content);
          
          if (error) { alert("Erro ao fazer upload da mídia."); return; }
          
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
          title: type === 'audio' ? 'Áudio Personalizado' : (textCaption || 'Mensagem Rápida'),
          content: payload,
          scheduled_for: scheduledFor.toISOString(),
          status: 'pending'
      });

      if (error) {
          console.error(error);
          alert("Erro ao agendar.");
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