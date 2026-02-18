import { useState, useCallback, useMemo, useEffect } from 'react';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useChatAutomation } from '@/hooks/useChatAutomation';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import { Chat } from '@/types';
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
  const { messages, loading: loadingMsgs, isSendingMsg, sendMessage, deleteMessage, editMessage, setMessages } = useChatMessages(chat, {
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
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  // Effect para remover pendingMessages quando a mensagem real chegar OU quando for apagada
  // IMPORTANTE: Só depende de messages. Incluir pendingMessages causaria loop infinito
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
          // Remove se: mesmo texto no mesmo horário OU se a mensagem foi apagada (revoked) no mesmo horário
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
  const [sequenceMode, setSequenceMode] = useState<'script'|'funnel'>('funnel');
  
  // Estados para Agendamento IA
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [appointmentData, setAppointmentData] = useState<PreScheduleData | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  // Estados do ChatInput
  // REMOVIDO: isRecording e recordingDuration (agora gerenciados internamente pelo ChatInput)
  const [replyTo, setReplyTo] = useState<any>(null);
  const [editingMessage, setEditingMessage] = useState<any>(null);

  // --- LÓGICA DE ENVIO DE ARQUIVO/ÁUDIO ---
  // Atualizado para aceitar 'metadata' (onde vem a duração do áudio)
  // Memoizado para evitar recriação a cada render
  const handleSendFile = useCallback(async (file: File | Blob, caption: string, typeOverride?: string, metadata?: any) => {
    if (!chat) return;
    
    // Se for Blob (áudio), converte para File
    let fileToUpload = file;
    if (file instanceof Blob && !(file instanceof File)) {
        fileToUpload = new File([file], `audio_${Date.now()}.webm`, { type: 'audio/webm' });
    }
    const finalFile = fileToUpload as File;

    const tempId = `temp_${Date.now()}`;
    const isNewChat = !chat.id || String(chat.id).startsWith('new_');
    
    // Determina tipo
    let evolutionMediaType = typeOverride || 'document';
    if (!typeOverride) {
        if (finalFile.type.startsWith('image/')) evolutionMediaType = 'image';
        else if (finalFile.type.startsWith('video/')) evolutionMediaType = 'video';
        else if (finalFile.type.startsWith('audio/')) evolutionMediaType = 'audio';
    }

    // 1. UI Otimista
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
        // 2. Resolve ID Real
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

        // 3. Upload Supabase
        const cleanName = finalFile.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const fileName = `${realChatId}_${Date.now()}_${cleanName}`;
        
        const { error: uploadError } = await supabase.storage.from('midia').upload(`uploads/${fileName}`, finalFile, { contentType: finalFile.type, upsert: true });
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage.from('midia').getPublicUrl(`uploads/${fileName}`);

        // 4. Salva no banco com metadata (duração + arquivo) e envia pela API oficial
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
      // Implementar lógica de "digitando..." se necessário
  }, []);

  // Função para agendamento com IA - memoizada
  const handleAISchedule = useCallback(async () => {
    if (!chat || messages.length === 0) {
      toast.error('Não há mensagens na conversa para analisar.');
      return;
    }

    setIsLoadingAI(true);

    try {
      // Formatar mensagens para envio à API
      const formattedMessages = messages
        .slice(-30) // Últimas 30 mensagens
        .map((msg: any) => ({
          sender: msg.sender === 'HUMAN_AGENT' ? 'me' : 'contact',
          message_text: msg.message_text || msg.message || '[Mídia]'
        }));

      // Chamar API da IA com timeout de 60 segundos
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 segundos
      
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
          throw new Error('Request timed out. A requisição demorou mais de 60 segundos. Tente novamente ou abra o formulário manualmente.');
        }
        throw fetchError;
      }
      clearTimeout(timeoutId);

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        let errorMessage = 'Erro ao processar com IA';
        
        try {
          if (contentType?.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } else {
            // Se for HTML (página de erro do Next.js), tentar extrair mensagem do JSON embutido
            const errorText = await response.text();
            
            // Tentar extrair mensagem de erro do HTML/JSON embutido
            const jsonMatch = errorText.match(/"message"\s*:\s*"([^"]+)"/);
            if (jsonMatch && jsonMatch[1]) {
              errorMessage = jsonMatch[1];
            } else {
              // Tentar parsear como JSON direto
              try {
                const errorData = JSON.parse(errorText);
                errorMessage = errorData.error || errorData.message || errorMessage;
              } catch {
                // Se não conseguir parsear, verificar se há mensagem de erro conhecida
                if (errorText.includes('OPENAI_API_KEY')) {
                  errorMessage = 'Chave da API OpenAI não configurada. Adicione OPENAI_API_KEY no arquivo .env.local';
                } else if (errorText.includes('Missing credentials')) {
                  errorMessage = 'Chave da API OpenAI não configurada. Adicione OPENAI_API_KEY no arquivo .env.local';
                } else {
                  errorMessage = `Erro do servidor (Status: ${response.status})`;
                }
              }
            }
          }
        } catch (parseError) {
          console.error('Erro ao processar resposta de erro:', parseError);
          errorMessage = `Erro ao processar com IA (Status: ${response.status})`;
        }
        
        throw new Error(errorMessage);
      }

      const data: PreScheduleData = await response.json();
      
      // Criar resumo da conversa para exibir no modal
      const conversationSummary = messages
        .slice(-10) // Últimas 10 mensagens para resumo
        .map((msg: any) => {
          const sender = msg.sender === 'HUMAN_AGENT' ? 'Clínica' : 'Paciente';
          const text = msg.message_text || msg.message || '[Mídia]';
          return `${sender}: ${text}`;
        })
        .join('\n');

      setAppointmentData(data);
      setIsAppointmentModalOpen(true);
    } catch (error: any) {
      // Extrair mensagem de erro de forma limpa
      let errorMessage = 'Erro desconhecido ao processar com IA';
      
      if (error?.message) {
        // Verificar se é timeout
        if (error.message.includes('timed out') || error.message.includes('Request timed out') || error.message.includes('AbortError')) {
          errorMessage = 'A requisição demorou muito para responder. Isso pode acontecer quando a API da OpenAI está lenta. Tente novamente ou abra o formulário manualmente.';
        } else if (error.message.includes('<!DOCTYPE') || error.message.includes('<html')) {
          // É uma página HTML de erro, extrair mensagem útil
          const missingKeyMatch = error.message.match(/Missing credentials[^"]*|OPENAI_API_KEY[^"]*/);
          if (missingKeyMatch) {
            errorMessage = 'Chave da API OpenAI não configurada. Adicione OPENAI_API_KEY no arquivo .env.local';
          } else {
            errorMessage = 'Erro no servidor ao processar com IA. Verifique se a chave OPENAI_API_KEY está configurada.';
          }
        } else {
          errorMessage = error.message;
        }
      }
      
      console.error('Erro ao processar agendamento com IA:', errorMessage, error);
      
      const shouldContinue = await toast.confirm(
        `Erro ao processar com IA: ${errorMessage}. Deseja abrir o formulário de agendamento vazio mesmo assim?`,
        'Continuar mesmo assim?'
      );
      if (shouldContinue) {
        setAppointmentData(null);
        setIsAppointmentModalOpen(true);
      }
    } finally {
      setIsLoadingAI(false);
    }
  }, [chat, messages]);

  // Memoizar resumo da conversa para evitar recálculo
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

  // Memoizar callbacks do modal de appointment
  const handleCloseAppointmentModal = useCallback(() => {
    setIsAppointmentModalOpen(false);
    setAppointmentData(null);
  }, []);

  const handleSaveAppointment = useCallback(() => {
    setIsAppointmentModalOpen(false);
    setAppointmentData(null);
  }, []);

  // Memoizar callbacks do MessageList
  const handleSaveMacroFromMessage = useCallback((macro: { title: string; type: 'text' | 'audio' | 'image' | 'video' | 'document'; content: string }) => {
    setEditingItem({
      title: macro.title || '',
      content: macro.content || '',
      type: macro.type || 'text',
    });
    setIsMacroModalOpen(true);
  }, []);

  // Memoizar callbacks do ChatInput
  const handleSendMessage = useCallback(async (txt: string, _type?: string, _file?: File, metadata?: any) => {
    if (!txt.trim() || !chat) return;

    if (metadata?.editingMessage) {
      await editMessage(metadata.editingMessage, txt);
      setEditingMessage(null);
      return;
    }

    const replyMeta = metadata?.replyTo ?? null;
    
    // Optimistic UI: Adiciona mensagem imediatamente
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
      ...(replyMeta?.wpp_id
        ? {
            tool_data: {
              reply_to: {
                wpp_id: replyMeta.wpp_id,
                sender: replyMeta.sender || '',
                message_type: replyMeta.message_type || 'text',
                message_text: replyMeta.message_text || '',
              },
            },
          }
        : {}),
    };
    
    // Adiciona imediatamente na UI (instantâneo)
    setPendingMessages(prev => [...prev, optimisticMsg]);
    
    // Envia em background (não bloqueia UI)
    sendMessage(txt, { replyTo: replyMeta }).then(() => {
      setReplyTo(null);
      // Remove a mensagem otimista quando a real chegar (via subscription)
      // A subscription do useChatMessages vai adicionar a mensagem real
      // Usamos um timeout curto para remover a pending quando a real chegar
      const removeTimeout = setTimeout(() => {
        setPendingMessages(prev => {
          // Remove apenas se ainda existir (pode já ter sido removida pela subscription)
          return prev.filter(m => m.id !== tempId);
        });
      }, 500); // Remove após 500ms (tempo suficiente para a subscription detectar)
      
      // Limpa o timeout se a mensagem real já chegou
      // Isso será feito pela subscription que detecta a mensagem real
    }).catch((error) => {
      const errorMessage =
        (error && typeof error === 'object' && 'message' in error && typeof (error as any).message === 'string'
          ? (error as any).message
          : 'Falha ao enviar mensagem');
      console.error('Erro ao enviar mensagem:', errorMessage, error);
      // Marca como erro na UI
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

  const handleSendAudio = useCallback((blob: Blob, duration: number) => {
    handleSendFile(blob, '', 'audio', { duration });
  }, [handleSendFile]);

  const handleSendMedia = useCallback((file: File) => {
    handleSendFile(file, '');
  }, [handleSendFile]);

  // Memoizar callbacks do ChatSidebar
  const handleOpenMacroModal = useCallback((m?: any) => {
    setEditingItem(m || null);
    setIsMacroModalOpen(true);
  }, []);

  const handleOpenSequenceModal = useCallback((item?: any, mode?: 'script'|'funnel') => {
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

  if (!chat) {
    return (
      <div className="flex-1 bg-[#f0f2f5] dark:bg-[#111b21] flex items-center justify-center text-gray-400 dark:text-gray-600 border-b-[6px] border-[#25d366]">
        <User size={64}/>
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
        <ConfirmModal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} onConfirm={confirmData?.onConfirm || (() => {})} title={confirmData?.title || ''} message={confirmData?.message || ''} />
        <ImagePreviewModal isOpen={!!previewImage} onClose={() => setPreviewImage(null)} src={previewImage} />
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
                onPreviewImage={setPreviewImage}
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