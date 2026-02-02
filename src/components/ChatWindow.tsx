import { useState, useCallback, useMemo, useEffect } from 'react';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useChatAutomation } from '@/hooks/useChatAutomation';
import { supabase } from '@/lib/supabase';
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

// Configuração do Webhook
const N8N_MEDIA_WEBHOOK = "https://n8n-n8n.rozhd7.easypanel.host/webhook/enviar-midia-app"; 

export default function ChatWindow({ chat }: { chat: Chat | null }) {
  // Hooks
  const { messages, loading: loadingMsgs, isSendingMsg, sendMessage, deleteMessage, setMessages } = useChatMessages(chat);
  const { 
    macros, funnels, scheduledMessages, activeTab, setActiveTab, isProcessingMacro, executions,
    handleRunFunnel, handleRunScriptStep, handleMacroSend, handleSaveMacro, handleSaveSequence, 
    handleDeleteItem, handleScheduleItem, handleScheduleAdHoc, handleCancelSchedule 
  } = useChatAutomation(chat);

  // UI States
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedItemId, setExpandedItemId] = useState<string | number | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [pendingMessages, setPendingMessages] = useState<any[]>([]);
  
  // Effect para remover pendingMessages quando a mensagem real chegar
  useEffect(() => {
    if (messages.length === 0 || pendingMessages.length === 0) return;
    
    // Para cada mensagem real recente, verifica se há uma pending com o mesmo texto e remove
    const recentRealMessages = messages.slice(-5); // Últimas 5 mensagens
    recentRealMessages.forEach(realMsg => {
      if (realMsg && realMsg.sender === 'HUMAN_AGENT') {
        setPendingMessages(prev => {
          return prev.filter(pending => {
            // Remove se o texto e timestamp forem próximos (dentro de 3 segundos)
            const timeDiff = Math.abs(
              new Date(realMsg.created_at).getTime() - 
              new Date(pending.created_at).getTime()
            );
            const isSameText = pending.message_text?.trim() === realMsg.message_text?.trim();
            
            // Se for a mesma mensagem (mesmo texto e tempo próximo), remove a pending
            return !(isSameText && timeDiff < 3000);
          });
        });
      }
    });
  }, [messages, pendingMessages]);

  // Modais
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isMacroModalOpen, setIsMacroModalOpen] = useState(false);
  const [isSequenceModalOpen, setIsSequenceModalOpen] = useState(false);
  const [isCreateScheduleOpen, setIsCreateScheduleOpen] = useState(false);
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
        media_url: evolutionMediaType === 'audio' || evolutionMediaType === 'image' ? URL.createObjectURL(finalFile) : undefined,
        created_at: new Date().toISOString(),
        sender: 'HUMAN_AGENT',
        status: 'uploading',
        tool_data: metadata || {} // Salva duração na UI otimista
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

        // 4. Envio API
        if (evolutionMediaType === 'document') {
            await fetch(N8N_MEDIA_WEBHOOK, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chatId: realChatId,
                    number: chat.phone.replace(/\D/g, ''),
                    mediatype: evolutionMediaType,
                    mimetype: finalFile.type,
                    media: encodeURI(publicUrl),
                    fileName: finalFile.name,
                    caption: caption || ''
                }),
            });
        } else {
            // Salva no banco com metadata (duração)
            const { data: dbMsg } = await supabase.from('chat_messages').insert({
                chat_id: realChatId,
                phone: chat.phone,
                message_text: caption || finalFile.name,
                message_type: evolutionMediaType,
                media_url: publicUrl,
                sender: 'HUMAN_AGENT',
                tool_data: metadata || {} // Salva duração no banco
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
                    options: metadata // Passa opções extras se a API suportar
                }),
            });
        }

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
      alert('Não há mensagens na conversa para analisar.');
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
      
      // Perguntar se deseja continuar com formulário vazio
      const shouldContinue = window.confirm(
        `Erro ao processar com IA: ${errorMessage}\n\nDeseja abrir o formulário de agendamento vazio mesmo assim?`
      );
      
      if (shouldContinue) {
        // Abrir modal vazio mesmo em caso de erro
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
  const handleSaveMacroFromMessage = useCallback((txt: string) => {
    setEditingItem({ title: '', content: txt, type: 'text' });
    setIsMacroModalOpen(true);
  }, []);

  // Memoizar callbacks do ChatInput
  const handleSendMessage = useCallback(async (txt: string) => {
    if (!txt.trim() || !chat) return;
    
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
      phone: chat.phone
    };
    
    // Adiciona imediatamente na UI (instantâneo)
    setPendingMessages(prev => [...prev, optimisticMsg]);
    
    // Envia em background (não bloqueia UI)
    sendMessage(txt).then(() => {
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
      console.error('Erro ao enviar mensagem:', error);
      // Marca como erro na UI
      setPendingMessages(prev => prev.map(m => 
        m.id === tempId ? { ...m, status: 'error', errorDetail: error.message } : m
      ));
    });
  }, [sendMessage, chat]);

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
    setIsCreateScheduleOpen(true);
  }, []);

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
        <SequenceEditorModal isOpen={isSequenceModalOpen} onClose={() => setIsSequenceModalOpen(false)} onSave={(d) => handleSaveSequence(d, editingItem?.id)} initialData={editingItem} mode={sequenceMode} macros={macros} />
        <CreateScheduleModal isOpen={isCreateScheduleOpen} onClose={() => setIsCreateScheduleOpen(false)} macros={macros} funnels={funnels} onConfirmAdHoc={handleScheduleAdHoc} onConfirmSaved={handleScheduleItem} />
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

        <div className="flex-1 flex flex-col min-w-0 relative overflow-hidden">
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
                onPreviewImage={setPreviewImage}
            />
            
            {/* CORREÇÃO AQUI: Props atualizadas para a nova versão do ChatInput */}
            <ChatInput 
                onSendMessage={handleSendMessage}
                onSendAudio={handleSendAudio}
                onSendMedia={handleSendMedia}
                onTyping={handleTyping}
                replyTo={replyTo}
                onCancelReply={() => setReplyTo(null)}
            />
        </div>

        <ChatSidebar 
            activeTab={activeTab} setActiveTab={setActiveTab}
            macros={macros} funnels={funnels} scheduledMessages={scheduledMessages}
            searchTerm={searchTerm} setSearchTerm={setSearchTerm}
            expandedItemId={expandedItemId} setExpandedItemId={setExpandedItemId}
            isProcessingMacro={isProcessingMacro} executions={executions}
            onOpenMacroModal={handleOpenMacroModal}
            onOpenSequenceModal={handleOpenSequenceModal}
            onOpenScheduleModal={handleOpenScheduleModal}
            onRunFunnel={handleRunFunnel} onRunScriptStep={handleRunScriptStep} onMacroSend={handleMacroSend}
            onDelete={confirmDeleteAction} onCancelSchedule={handleCancelSchedule}
        />
    </div>
  );
}