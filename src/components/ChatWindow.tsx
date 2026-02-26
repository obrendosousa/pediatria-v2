import { useState, useCallback, useMemo, useEffect } from 'react';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useChatAutomation } from '@/hooks/useChatAutomation';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import { Chat } from '@/types';
import type { Message } from '@/types';
import { User } from 'lucide-react';

// Componentes de Interface
import ChatHeader from './chat/ChatHeader';
import ChatInput from './chat/ChatInput';
import MessageList from './chat/MessageList';
import ChatSidebar from './chat/ChatSidebar';

// Modais de suporte
import MacroModal from './chat/modals/MacroModal';
import SequenceEditorModal from './chat/modals/SequenceEditorModal';
import ConfirmModal from './chat/modals/ConfirmModal';
import ImagePreviewModal from './chat/modals/ImagePreviewModal';
import CreateScheduleModal from './chat/modals/CreateScheduleModal';
import ForwardMessageModal from './chat/modals/ForwardMessageModal';
import AppointmentModal, { PreScheduleData } from './medical/AppointmentModal';
import { useToast } from '@/contexts/ToastContext';

export default function ChatWindow({ chat }: { chat: Chat | null }) {
  const { toast } = useToast();
  const [pendingMessages, setPendingMessages] = useState<any[]>([]);

  const onRemovePending = useCallback((tempId: string) => {
    setPendingMessages((prev) => prev.filter((p) => p.id !== tempId));
  }, []);
  const onRemovePendingForRevoked = useCallback((createdAt: string) => {
    const revokedTime = new Date(createdAt).getTime();
    setPendingMessages((prev) =>
      prev.filter(
        (p) =>
          Math.abs(new Date(p.created_at || 0).getTime() - revokedTime) >= 10000
      )
    );
  }, []);
  const { messages, loading: loadingMsgs, isSendingMsg, sendMessage, deleteMessage, editMessage, reactToMessage, setMessages } = useChatMessages(chat, {
    onRemovePending,
    onRemovePendingForRevoked
  });
  const {
    macros, funnels, scheduledMessages, activeTab, setActiveTab, isProcessingMacro, processingActionId, executions,
    handleRunFunnel, handleRunScriptStep, handleMacroSend, handleSaveMacro, handleSaveSequence,
    handleDeleteItem, handleScheduleItem, handleScheduleAdHoc, handleCancelSchedule
  } = useChatAutomation(chat);

  // UI States
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedItemId, setExpandedItemId] = useState<string | number | null>(null);
  const [previewMedia, setPreviewMedia] = useState<{ src: string; type: 'image' | 'video' } | null>(null);

  useEffect(() => {
    setPreviewMedia(null);
  }, [chat?.id]);

  // Sincroniza o estado local com o prop ao trocar de conversa
  useEffect(() => {
    setAiDraftText(chat?.ai_draft_reply ?? null);
    setAiDraftReason(chat?.ai_draft_reason ?? null);
  }, [chat?.id, chat?.ai_draft_reply, chat?.ai_draft_reason]);

  // Subscrição Realtime: captura drafts gerados pelo Copiloto após o carregamento inicial
  useEffect(() => {
    if (!chat?.id) return;

    const channel = supabase
      .channel(`copilot-draft-${chat.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chats', filter: `id=eq.${chat.id}` },
        (payload) => {
          const updated = payload.new as any;
          setAiDraftText(updated.ai_draft_reply ?? null);
          setAiDraftReason(updated.ai_draft_reason ?? null);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [chat?.id]);

  // Prefetch da lista de chats para o modal de encaminhar (abre instantâneo)
  useEffect(() => {
    if (!chat?.id || String(chat.id).startsWith('new_')) {
      setForwardChatsCache(null);
      return;
    }
    let cancelled = false;
    supabase
      .from('chats')
      .select('id, phone, contact_name, profile_pic, last_message, last_interaction_at')
      .eq('is_archived', false)
      .neq('id', chat.id)
      .order('last_interaction_at', { ascending: false })
      .limit(60)
      .then(
        ({ data }) => {
          if (!cancelled && data) setForwardChatsCache(data as Chat[]);
        },
        () => {
          if (!cancelled) setForwardChatsCache([]);
        }
      );
    return () => { cancelled = true; };
  }, [chat?.id]);

  useEffect(() => {
    if (messages.length === 0) return;

    const recentRealMessages = messages.slice(-10).filter((m): m is NonNullable<typeof m> => m != null && m.sender === 'HUMAN_AGENT');
    if (recentRealMessages.length === 0) return;

    setPendingMessages(prev => {
      if (prev.length === 0) return prev;
      return prev.filter(pending => {
        const shouldRemove = recentRealMessages.some(realMsg => {
          const timeDiff = Math.abs(
            new Date(realMsg.created_at).getTime() - new Date(pending.created_at || 0).getTime()
          );
          const isRevoked = (realMsg as any).message_type === 'revoked';
          const isSameText = pending.message_text?.trim() === realMsg.message_text?.trim();
          const isSameRevoked = isRevoked && timeDiff < 10000;
          return (isSameText && timeDiff < 3000) || isSameRevoked;
        });
        return !shouldRemove;
      });
    });
  }, [messages]);

  // Modais
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isMacroModalOpen, setIsMacroModalOpen] = useState(false);
  const [isSequenceModalOpen, setIsSequenceModalOpen] = useState(false);
  const [isCreateScheduleOpen, setIsCreateScheduleOpen] = useState(false);
  const [schedulePrefill, setSchedulePrefill] = useState<{ item: any | null; type: 'macro' | 'funnel' } | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmData, setConfirmData] = useState<any>(null);
  const [sequenceMode, setSequenceMode] = useState<'script' | 'funnel'>('funnel');

  // Estados para Agendamento IA
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [appointmentData, setAppointmentData] = useState<PreScheduleData | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  // Estados do ChatInput
  const [replyTo, setReplyTo] = useState<any>(null);
  const [editingMessage, setEditingMessage] = useState<any>(null);
  const [forwardMessage, setForwardMessage] = useState<Message | null>(null);
  const [forwardChatsCache, setForwardChatsCache] = useState<Chat[] | null>(null);

  // Estado reativo do draft da IA (atualizado em tempo real via Supabase Realtime)
  const [aiDraftText, setAiDraftText] = useState<string | null>(chat?.ai_draft_reply ?? null);
  const [aiDraftReason, setAiDraftReason] = useState<string | null>(chat?.ai_draft_reason ?? null);
  const [isLoadingAISuggestion, setIsLoadingAISuggestion] = useState(false);

  // Modo Plano — disponível apenas no chat interno da Clara (phone='00000000000')
  const isClaraChat = chat?.phone === '00000000000';
  const [isPlanMode, setIsPlanMode] = useState(false);
  const [lastPlanTask, setLastPlanTask] = useState<string | null>(null);

  const handleSendFile = useCallback(async (file: File | Blob, caption: string, typeOverride?: string, metadata?: any) => {
    if (!chat) return;

    let fileToUpload = file;
    if (file instanceof Blob && !(file instanceof File)) {
      fileToUpload = new File([file], `audio_${Date.now()}.webm`, { type: 'audio/webm' });
    }
    const finalFile = fileToUpload as File;

    const tempId = `temp_${Date.now()}`;
    const isNewChat = !chat.id || String(chat.id).startsWith('new_');

    let evolutionMediaType = typeOverride || 'document';
    if (!typeOverride) {
      if (finalFile.type.startsWith('image/')) evolutionMediaType = 'image';
      else if (finalFile.type.startsWith('video/')) evolutionMediaType = 'video';
      else if (finalFile.type.startsWith('audio/')) evolutionMediaType = 'audio';
    }

    const optimisticMsg = {
      id: tempId,
      message_text: caption || finalFile.name,
      message_type: evolutionMediaType,
      media_url: evolutionMediaType === 'audio' || evolutionMediaType === 'image' || evolutionMediaType === 'video'
        ? URL.createObjectURL(finalFile)
        : undefined,
      created_at: new Date().toISOString(),
      sender: 'HUMAN_AGENT',
      status: 'uploading',
      tool_data: {
        ...(metadata || {}),
        mime_type: finalFile.type,
        file_name: finalFile.name,
        file_size: finalFile.size,
      }
    };
    setPendingMessages(prev => [...prev, optimisticMsg]);

    try {
      let realChatId = chat.id;
      if (isNewChat) {
        const cleanPhone = chat.phone.replace(/\D/g, '');
        const { data: existing } = await supabase.from('chats').select('id').eq('phone', cleanPhone).maybeSingle();
        if (existing) {
          realChatId = existing.id;
        } else {
          const { data: newChat, error: createError } = await supabase.from('chats').insert({
            phone: cleanPhone,
            contact_name: chat.contact_name || cleanPhone,
            status: 'ACTIVE',
            created_at: new Date().toISOString(),
            last_interaction_at: new Date().toISOString()
          }).select().single();
          if (createError) throw createError;
          realChatId = newChat.id;
        }
      }

      const cleanName = finalFile.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const fileName = `${realChatId}_${Date.now()}_${cleanName}`;

      const { error: uploadError } = await supabase.storage.from('midia').upload(`uploads/${fileName}`, finalFile, { contentType: finalFile.type, upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('midia').getPublicUrl(`uploads/${fileName}`);

      const enrichedMetadata = {
        ...(metadata || {}),
        mime_type: finalFile.type,
        file_name: finalFile.name,
        file_size: finalFile.size,
      };
      const { data: dbMsg } = await supabase.from('chat_messages').insert({
        chat_id: realChatId,
        phone: chat.phone,
        message_text: caption || finalFile.name,
        message_type: evolutionMediaType,
        media_url: publicUrl,
        sender: 'HUMAN_AGENT',
        status: 'sent',
        tool_data: enrichedMetadata
      }).select().single();

      await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: realChatId,
          phone: chat.phone,
          message: caption,
          type: evolutionMediaType,
          mediaUrl: publicUrl,
          dbMessageId: dbMsg?.id,
          options: enrichedMetadata
        }),
      });

      if (isNewChat) {
        const { data: updatedMsgs } = await supabase.from('chat_messages').select('*').eq('chat_id', realChatId).order('created_at', { ascending: true });
        if (updatedMsgs) setMessages(updatedMsgs);
      }

      setTimeout(() => setPendingMessages(prev => prev.filter(m => m.id !== tempId)), 500);

    } catch (err: any) {
      console.error('[Erro] Falha no envio:', err);
      setPendingMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'error', errorDetail: err.message } : m));
    }
  }, [chat]);

  const confirmDeleteAction = useCallback((id: number, table: 'macros' | 'funnels') => {
    setConfirmData({
      title: "Excluir?", message: "Esta ação não pode ser desfeita.",
      onConfirm: () => { handleDeleteItem(id, table); setIsConfirmModalOpen(false); }
    });
    setIsConfirmModalOpen(true);
  }, [handleDeleteItem]);

  const handleTyping = useCallback((isTyping: boolean) => {
  }, []);

  const handleAISchedule = useCallback(async () => {
    if (!chat || messages.length === 0) {
      toast.error('Não há mensagens na conversa para analisar.');
      return;
    }

    setIsLoadingAI(true);

    try {
      const formattedMessages = messages
        .slice(-30)
        .map((msg: any) => ({
          sender: msg.sender === 'HUMAN_AGENT' ? 'me' : 'contact',
          message_text: msg.message_text || msg.message || '[Mídia]'
        }));

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      let response: Response;
      try {
        response = await fetch('/api/ai/pre-schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: formattedMessages }),
          signal: controller.signal
        });
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('Request timed out. A requisição demorou mais de 60 segundos.');
        }
        throw fetchError;
      }
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Erro ao processar com IA (Status: ${response.status})`);
      }

      const data: PreScheduleData = await response.json();
      setAppointmentData(data);
      setIsAppointmentModalOpen(true);
    } catch (error: any) {
      console.error('Erro ao processar agendamento com IA:', error);
      const shouldContinue = await toast.confirm(
        `Erro ao processar com IA. Deseja abrir o formulário vazio mesmo assim?`,
        'Continuar?'
      );
      if (shouldContinue) {
        setAppointmentData(null);
        setIsAppointmentModalOpen(true);
      }
    } finally {
      setIsLoadingAI(false);
    }
  }, [chat, messages]);

  const conversationSummary = useMemo(() => {
    return messages
      .slice(-10)
      .map((msg: any) => {
        const sender = msg.sender === 'HUMAN_AGENT' ? 'Clínica' : 'Paciente';
        const text = msg.message_text || msg.message || '[Mídia]';
        return `${sender}: ${text}`;
      })
      .join('\n');
  }, [messages]);

  const handleCloseAppointmentModal = useCallback(() => {
    setIsAppointmentModalOpen(false);
    setAppointmentData(null);
  }, []);

  const handleSaveAppointment = useCallback(() => {
    setIsAppointmentModalOpen(false);
    setAppointmentData(null);
  }, []);

  const handleSaveMacroFromMessage = useCallback((macro: { title: string; type: 'text' | 'audio' | 'image' | 'video' | 'document'; content: string }) => {
    setEditingItem({
      title: macro.title || '',
      content: macro.content || '',
      type: macro.type || 'text',
    });
    setIsMacroModalOpen(true);
  }, []);

  const handleSendMessage = useCallback(async (txt: string, _type?: string, _file?: File, metadata?: any) => {
    if (!txt.trim() || !chat) return;

    // Modo Plano: prefixar com [PLANEJAR] e guardar a tarefa original para o botão Executar
    if (isClaraChat && isPlanMode && !metadata?.editingMessage) {
      setLastPlanTask(txt);
      txt = `[PLANEJAR] ${txt}`;
    }

    if (metadata?.editingMessage) {
      await editMessage(metadata.editingMessage, txt);
      setEditingMessage(null);
      return;
    }

    const replyMeta = metadata?.replyTo ?? null;

    const tempId = `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const optimisticMsg = {
      id: tempId,
      message_text: txt,
      message_type: 'text',
      created_at: new Date().toISOString(),
      sender: 'HUMAN_AGENT',
      status: 'sending',
      chat_id: chat.id,
      phone: chat.phone,
      ...(replyMeta?.wpp_id || replyMeta?.message_text
        ? {
          tool_data: {
            reply_to: {
              wpp_id: replyMeta?.wpp_id || undefined,
              sender: replyMeta?.sender || '',
              message_type: replyMeta?.message_type || 'text',
              message_text: replyMeta?.message_text || '',
            },
          },
        }
        : {}),
    };

    setPendingMessages(prev => [...prev, optimisticMsg]);

    sendMessage(txt, { replyTo: replyMeta }).then(() => {
      setReplyTo(null);
      setTimeout(() => {
        setPendingMessages(prev => prev.filter(m => m.id !== tempId));
      }, 500);
    }).catch((error) => {
      const errorMessage =
        (error && typeof error === 'object' && 'message' in error && typeof (error as any).message === 'string'
          ? (error as any).message
          : 'Falha ao enviar mensagem');
      setPendingMessages(prev => prev.map(m =>
        m.id === tempId ? { ...m, status: 'error', errorDetail: errorMessage } : m
      ));
    });
  }, [sendMessage, editMessage, chat]);

  const handleReplyMessage = useCallback((msg: any) => {
    setReplyTo(msg);
    setEditingMessage(null);
  }, []);

  const handleEditMessage = useCallback((msg: any) => {
    setEditingMessage(msg);
    setReplyTo(null);
  }, []);

  const handleForwardMessage = useCallback((msg: Message) => {
    setForwardMessage(msg);
  }, []);

  const handleConfirmForward = useCallback((targetChat: Chat) => {
    const msg = forwardMessage;
    if (!msg) return;
    setForwardMessage(null);
    toast.info('Encaminhando...');
    (async () => {
      try {
        const type = String(msg.message_type || 'text').toLowerCase();
        const text = (msg.message_text || '').trim();
        const mediaUrl = msg.media_url || undefined;
        const body: Record<string, unknown> = {
          chatId: targetChat.id,
          phone: targetChat.phone,
          message: type === 'text' ? text : (text || (type === 'audio' ? 'Áudio' : 'Mídia')),
          type: type === 'ptt' ? 'audio' : type,
        };
        if (mediaUrl && (type === 'image' || type === 'video' || type === 'audio' || type === 'document')) {
          body.mediaUrl = mediaUrl;
        }
        const res = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error((data as { error?: string }).error || 'Falha ao encaminhar');
        }
        toast.success('Mensagem encaminhada.');
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : 'Erro ao encaminhar';
        toast.error(errMsg);
      }
    })();
  }, [forwardMessage, toast]);

  const handleSendAudio = useCallback((blob: Blob, duration: number) => {
    handleSendFile(blob, '', 'audio', { duration });
  }, [handleSendFile]);

  const handleSendMedia = useCallback((file: File) => {
    handleSendFile(file, '');
  }, [handleSendFile]);

  const handleOpenMacroModal = useCallback((m?: any) => {
    setEditingItem(m || null);
    setIsMacroModalOpen(true);
  }, []);

  const handleOpenSequenceModal = useCallback((item?: any, mode?: 'script' | 'funnel') => {
    setEditingItem(item || null);
    setSequenceMode(item ? item.type : mode || 'funnel');
    setIsSequenceModalOpen(true);
  }, []);

  const handleOpenScheduleModal = useCallback((item?: any, type?: 'macro' | 'funnel') => {
    setSchedulePrefill({
      item: item || null,
      type: type || 'macro',
    });
    setIsCreateScheduleOpen(true);
  }, []);

  const handleTogglePlanMode = useCallback(() => {
    setIsPlanMode((prev) => !prev);
  }, []);

  const handleExecutePlan = useCallback(() => {
    if (!lastPlanTask) return;
    const task = lastPlanTask;
    setLastPlanTask(null);
    setIsPlanMode(false);
    handleSendMessage(task);
  }, [lastPlanTask, handleSendMessage]);

  const handleRequestAISuggestion = useCallback(async () => {
    if (!chat?.id || isLoadingAISuggestion) return;
    setIsLoadingAISuggestion(true);
    try {
      const res = await fetch('/api/ai/copilot/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chat.id }),
      });
      if (!res.ok) throw new Error('Falha ao acionar o copiloto');
      // O draft chegará via Supabase Realtime — não precisa ler o body
    } catch (e) {
      toast.error('Não foi possível gerar a sugestão.');
    } finally {
      setIsLoadingAISuggestion(false);
    }
  }, [chat?.id, isLoadingAISuggestion, toast]);

  const handleClearDraft = useCallback(async () => {
    if (!chat) return;
    const capturedDraft = aiDraftText;
    // Limpa a UI imediatamente (sem aguardar a rede)
    setAiDraftText(null);
    setAiDraftReason(null);
    try {
      await fetch('/api/ai/copilot/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chat.id,
          action: 'discarded',
          original_context: conversationSummary,
          draft_text: capturedDraft,
          final_text: null,
        }),
      });
    } catch (e) {
      console.error('Falha ao registrar descarte do draft:', e);
    }
  }, [chat, aiDraftText, conversationSummary]);

  const handleApproveDraft = useCallback(async (text: string) => {
    // Limpa a UI imediatamente antes de enviar
    setAiDraftText(null);
    setAiDraftReason(null);
    await handleSendMessage(text);
    toast.success('Sugestão enviada!');
    try {
      await fetch('/api/ai/copilot/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chat?.id,
          action: 'approved',
          original_context: conversationSummary,
          draft_text: text,
          final_text: text,
        }),
      });
    } catch (e) {
      console.error('Falha ao registrar aprovação do draft:', e);
    }
  }, [handleSendMessage, chat?.id, conversationSummary, toast]);

  useEffect(() => {
    const onShortcut = (e: KeyboardEvent) => {
      if (!chat) return;
      const key = e.key.toLowerCase();
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      if (isCmdOrCtrl && key === 'k') {
        e.preventDefault();
        setActiveTab('text');
        return;
      }

      if (e.altKey && key === '1') {
        e.preventDefault();
        setActiveTab('text');
        return;
      }
      if (e.altKey && key === '2') {
        e.preventDefault();
        setActiveTab('script');
        return;
      }
      if (e.altKey && key === '3') {
        e.preventDefault();
        setActiveTab('funnels');
        return;
      }
      if (e.altKey && key === '4') {
        e.preventDefault();
        setActiveTab('schedule');
        return;
      }
      if (e.altKey && key === '5') {
        e.preventDefault();
        setActiveTab('executions');
      }
    };

    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, [chat, setActiveTab]);

  useEffect(() => {
    const handleExecutePlanEvent = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail && handleSendMessage) {
        handleSendMessage(customEvent.detail);
      }
    };

    window.addEventListener('clara:execute_plan', handleExecutePlanEvent);
    return () => window.removeEventListener('clara:execute_plan', handleExecutePlanEvent);
  }, [handleSendMessage]);

  if (!chat) {
    return (
      <div className="flex-1 bg-[#f0f2f5] dark:bg-[#111b21] flex items-center justify-center text-gray-400 dark:text-gray-600 border-b-[6px] border-[#25d366]">
        <User size={64} />
      </div>
    );
  }

  return (
    <div className="flex-1 flex h-full overflow-hidden bg-[#efeae2] dark:bg-[#0b141a] relative transition-colors duration-300 min-w-0">
      <MacroModal isOpen={isMacroModalOpen} onClose={() => setIsMacroModalOpen(false)} onSave={(d) => handleSaveMacro(d, editingItem?.id)} initialData={editingItem} typeOverride={activeTab} />
      <SequenceEditorModal
        isOpen={isSequenceModalOpen}
        onClose={() => setIsSequenceModalOpen(false)}
        onSave={(d) => handleSaveSequence(d, editingItem?.id)}
        initialData={editingItem}
        mode={sequenceMode}
        macros={macros}
        funnels={funnels}
      />
      <CreateScheduleModal
        isOpen={isCreateScheduleOpen}
        onClose={() => {
          setIsCreateScheduleOpen(false);
          setSchedulePrefill(null);
        }}
        macros={macros}
        funnels={funnels}
        preselectedItem={schedulePrefill}
        onConfirmAdHoc={handleScheduleAdHoc}
        onConfirmSaved={handleScheduleItem}
      />
      <ConfirmModal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} onConfirm={confirmData?.onConfirm || (() => { })} title={confirmData?.title || ''} message={confirmData?.message || ''} />
      <ForwardMessageModal
        isOpen={!!forwardMessage}
        onClose={() => setForwardMessage(null)}
        message={forwardMessage}
        currentChatId={chat?.id ?? ''}
        onForward={handleConfirmForward}
        initialChats={forwardChatsCache}
      />
      <ImagePreviewModal
        isOpen={!!previewMedia}
        onClose={() => setPreviewMedia(null)}
        src={previewMedia?.src || null}
        mediaType={previewMedia?.type || 'image'}
      />
      <AppointmentModal
        isOpen={isAppointmentModalOpen}
        onClose={handleCloseAppointmentModal}
        initialData={appointmentData || undefined}
        chatPhone={chat.phone}
        conversationSummary={conversationSummary}
        onSave={handleSaveAppointment}
      />

      {/* Área do chat: reserva 70px à direita para a barra de ícones do ChatSidebar */}
      <div className="flex-1 flex flex-col min-w-0 relative overflow-hidden w-full pr-[58px] sm:pr-[70px]">
        <ChatHeader
          chat={chat}
          loadingMsgs={loadingMsgs}
          onAISchedule={handleAISchedule}
          isLoadingAI={isLoadingAI}
        />

        <MessageList
          messages={messages}
          pendingMessages={pendingMessages}
          chat={chat}
          onDelete={deleteMessage}
          onSaveMacro={handleSaveMacroFromMessage}
          onReply={handleReplyMessage}
          onEdit={handleEditMessage}
          onForward={handleForwardMessage}
          onReact={reactToMessage}
          onPreviewImage={(src) => setPreviewMedia({ src, type: 'image' })}
          onPreviewVideo={(src) => setPreviewMedia({ src, type: 'video' })}
        />

        <ChatInput
          onSendMessage={handleSendMessage}
          onSendAudio={handleSendAudio}
          onSendMedia={handleSendMedia}
          onTyping={handleTyping}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          editingMessage={editingMessage}
          onCancelEdit={() => setEditingMessage(null)}
          aiDraftText={aiDraftText}
          aiDraftReason={aiDraftReason}
          isLoadingAISuggestion={isLoadingAISuggestion}
          onRequestAISuggestion={handleRequestAISuggestion}
          onApproveAIDraft={handleApproveDraft}
          onDiscardAIDraft={handleClearDraft}
          isPlanMode={isPlanMode}
          onTogglePlanMode={isClaraChat ? handleTogglePlanMode : undefined}
          hasPendingPlan={!!lastPlanTask}
          onExecutePlan={handleExecutePlan}
        />
      </div>

      {/* Backdrop: clicar fora do sidebar fecha o painel */}
      {activeTab && (
        <button
          type="button"
          aria-label="Fechar menu lateral"
          className="absolute inset-0 z-30 bg-black/20 dark:bg-black/40 transition-opacity"
          onClick={() => setActiveTab(null)}
        />
      )}

      {/* Sidebar como popup sobrepondo o chat (não participa do flex) */}
      <div className="absolute right-0 top-0 bottom-0 z-40 flex flex-row-reverse pointer-events-none">
        <div className="pointer-events-auto h-full">
          <ChatSidebar
            activeTab={activeTab} setActiveTab={setActiveTab}
            chatId={chat?.id ?? 0}
            patientName={chat?.contact_name ?? 'Paciente'}
            macros={macros} funnels={funnels} scheduledMessages={scheduledMessages}
            searchTerm={searchTerm} setSearchTerm={setSearchTerm}
            expandedItemId={expandedItemId} setExpandedItemId={setExpandedItemId}
            isProcessingMacro={isProcessingMacro} processingActionId={processingActionId} executions={executions}
            onOpenMacroModal={handleOpenMacroModal}
            onOpenSequenceModal={handleOpenSequenceModal}
            onOpenScheduleModal={handleOpenScheduleModal}
            onRunFunnel={handleRunFunnel} onRunScriptStep={handleRunScriptStep} onMacroSend={handleMacroSend}
            onDelete={confirmDeleteAction} onCancelSchedule={handleCancelSchedule}
          />
        </div>
      </div>
    </div>
  );
}