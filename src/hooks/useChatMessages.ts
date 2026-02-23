import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import {
  get,
  set,
  TTL_MESSAGES_MS,
  MAX_CACHED_MESSAGES_PER_CHAT,
  touchMessagesCacheKey,
} from '@/lib/chatCache';
import { Chat, Message } from '@/types';
import { useToast } from '@/contexts/ToastContext';

interface ReplyTarget {
  wpp_id?: string;
  message_text?: string;
  message_type?: string;
  sender?: string;
}

interface SendMessageOptions {
  replyTo?: ReplyTarget | null;
}

interface UseChatMessagesOptions {
  /** Remove mensagem pendente da UI quando delete for chamado com msg pendente */
  onRemovePending?: (tempId: string) => void;
  /** Remove pendentes que correspondem a uma mensagem revogada (evita duplicata original + popup) */
  onRemovePendingForRevoked?: (createdAt: string) => void;
}

interface MessageReactionRow {
  target_wpp_id: string;
  emoji: string;
  sender_phone?: string | null;
  sender_name?: string | null;
  from_me?: boolean | null;
  created_at?: string;
}

function mergeReactionsIntoMessages(baseMessages: Message[], reactionRows: MessageReactionRow[]): Message[] {
  if (!baseMessages.length) return baseMessages;
  const grouped = new Map<string, MessageReactionRow[]>();
  reactionRows.forEach((row) => {
    const key = String(row.target_wpp_id || '').trim();
    if (!key) return;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(row);
  });

  return baseMessages.map((msg) => {
    const targetWppId = String((msg as any).wpp_id || '').trim();
    if (!targetWppId) return msg;
    const reactionsForMessage = grouped.get(targetWppId) || [];
    const normalized = reactionsForMessage.map((r) => ({
      emoji: r.emoji,
      sender_phone: r.sender_phone ?? null,
      sender_name: r.sender_name ?? null,
      from_me: Boolean(r.from_me),
      created_at: r.created_at,
    }));

    return {
      ...msg,
      reactions: normalized,
      tool_data: {
        ...(msg.tool_data || {}),
        reactions: normalized,
      },
    };
  });
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object') {
    const candidate = error as Record<string, unknown>;
    const msg = candidate.message || candidate.error_description || candidate.details || candidate.hint;
    if (typeof msg === 'string' && msg.trim()) return msg.trim();
    try {
      const raw = JSON.stringify(candidate);
      if (raw && raw !== '{}' && raw !== 'null') return raw;
    } catch {
      // ignore
    }
  }
  if (typeof error === 'string' && error.trim()) return error.trim();
  return 'Erro desconhecido ao enviar mensagem';
}

export function useChatMessages(activeChat: Chat | null, options?: UseChatMessagesOptions) {
  const { toast } = useToast();
  const { onRemovePending, onRemovePendingForRevoked } = options || {};
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSendingMsg, setIsSendingMsg] = useState(false);
  
  // Ref para guardar o ID real caso ele mude de 'new_...' para número durante a sessão
  const currentChatIdRef = useRef<number | string | null>(null);
  // IDs removidos localmente por chat (deleteForMe) - evita reintrodução por fetch/realtime atrasado
  const deletedIdsByChatRef = useRef<Map<string, Set<number | string>>>(new Map());

  const getDeletedSetForChat = (chatId: number | string) => {
    const key = String(chatId);
    let setForChat = deletedIdsByChatRef.current.get(key);
    if (!setForChat) {
      setForChat = new Set<number | string>();
      deletedIdsByChatRef.current.set(key, setForChat);
    }
    return setForChat;
  };

  // Sincroniza o Ref com o activeChat sempre que o componente pai mudar o chat selecionado
  useEffect(() => {
    if (activeChat) {
      currentChatIdRef.current = activeChat.id;
    }
  }, [activeChat?.id]);

  // Mantém o cache em sync quando messages mudam (optimistic send/delete ou realtime)
  useEffect(() => {
    const ownerChatId = currentChatIdRef.current;
    if (!ownerChatId || String(ownerChatId).startsWith('new_')) return;
    const key = `chat_messages_${ownerChatId}`;
    const toCache = messages.length > MAX_CACHED_MESSAGES_PER_CHAT
      ? messages.slice(-MAX_CACHED_MESSAGES_PER_CHAT)
      : messages;
    set(key, toCache, TTL_MESSAGES_MS);
    touchMessagesCacheKey(ownerChatId);
  }, [messages]);

  // 1. Carregar Mensagens e Inscrever no Realtime (com cache)
  useEffect(() => {
    if (!activeChat) {
      setMessages([]);
      return;
    }

    const isTempChat = String(activeChat.id).startsWith('new_');

    if (isTempChat) {
      setMessages([]);
      return;
    }

    const chatId = activeChat.id;
    const cacheKey = `chat_messages_${chatId}`;
    const cached = get<Message[]>(cacheKey);
    const hasValidCache = Array.isArray(cached) && cached.length >= 0;
    const deletedForChat = getDeletedSetForChat(chatId);
    if (hasValidCache && cached) {
      const cachedFiltered = deletedForChat.size > 0
        ? cached.filter((m) => !deletedForChat.has(m.id))
        : cached;
      setMessages(cachedFiltered);
      touchMessagesCacheKey(chatId);
    } else {
      setLoading(true);
    }

    const fetchMsgs = async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      const fetchAndApplyReactions = async (rawMessages: Message[]) => {
        const { data: reactionsData, error: reactionsError } = await supabase
          .from('message_reactions')
          .select('target_wpp_id, emoji, sender_phone, sender_name, from_me, created_at')
          .eq('chat_id', chatId);
        if (reactionsError || !Array.isArray(reactionsData)) return rawMessages;
        return mergeReactionsIntoMessages(rawMessages, reactionsData as MessageReactionRow[]);
      };

      if (!error && data) {
        if (String(currentChatIdRef.current) !== String(chatId)) {
          setLoading(false);
          return;
        }
        const deleted = getDeletedSetForChat(chatId);
        const filtered = deleted.size > 0 ? data.filter((m) => !deleted.has(m.id)) : data;
        const withReactions = await fetchAndApplyReactions(filtered as Message[]);
        setMessages((prev) => {
          if (String(currentChatIdRef.current) !== String(chatId)) return prev;
          const prevRevoked = new Map(prev.filter((m) => (m as any).message_type === 'revoked').map((m) => [m.id, m]));
          return withReactions.map((m) => {
            const wasRevoked = prevRevoked.get(m.id);
            if (wasRevoked) return wasRevoked;
            return m;
          });
        });
        const toCache = withReactions.length > MAX_CACHED_MESSAGES_PER_CHAT
          ? withReactions.slice(-MAX_CACHED_MESSAGES_PER_CHAT)
          : withReactions;
        set(cacheKey, toCache, TTL_MESSAGES_MS);
        touchMessagesCacheKey(chatId);
      }
      setLoading(false);
    };

    fetchMsgs();

    const chatMessagesChannel = supabase.channel(`chat_messages_realtime_${activeChat.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_messages',
        filter: `chat_id=eq.${activeChat.id}`,
      }, (payload) => {
        const updateCache = (next: Message[]) => {
          const toCache = next.length > MAX_CACHED_MESSAGES_PER_CHAT
            ? next.slice(-MAX_CACHED_MESSAGES_PER_CHAT)
            : next;
          set(cacheKey, toCache, TTL_MESSAGES_MS);
          touchMessagesCacheKey(chatId);
        };
        if (payload.eventType === 'INSERT') {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            const deleted = getDeletedSetForChat(chatId);
            if (deleted.has(newMsg.id)) return prev;
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            const next = [...prev, newMsg];
            updateCache(next);
            return next;
          });
        } else if (payload.eventType === 'DELETE') {
          setMessages((prev) => {
            const next = prev.filter((msg) => msg.id !== payload.old?.id);
            updateCache(next);
            return next;
          });
        } else if (payload.eventType === 'UPDATE') {
          setMessages((prev) => {
            const next = prev.map((msg) => {
              if (msg.id !== payload.new?.id) return msg;
              const incoming = payload.new as Message;
              const currentUpdatedAt = new Date((msg as any)?.updated_at || msg.created_at || 0).getTime();
              const incomingUpdatedAt = new Date((incoming as any)?.updated_at || incoming.created_at || 0).getTime();
              // Evita sobrescrever edição local mais nova por update atrasado.
              if (incomingUpdatedAt < currentUpdatedAt) return msg;
              return { ...msg, ...incoming };
            });
            updateCache(next);
            return next;
          });
        }
      })
      .subscribe();

    let reactionsChannel: ReturnType<typeof supabase.channel> | null = null;
    void (async () => {
      const { error: tableCheckError } = await supabase
        .from('message_reactions')
        .select('id')
        .limit(1);
      if (tableCheckError) return;

      reactionsChannel = supabase.channel(`message_reactions_realtime_${activeChat.id}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'message_reactions',
          filter: `chat_id=eq.${activeChat.id}`,
        }, async () => {
          const { data: reactionsData, error: reactionsError } = await supabase
            .from('message_reactions')
            .select('target_wpp_id, emoji, sender_phone, sender_name, from_me, created_at')
            .eq('chat_id', chatId);
          if (reactionsError || !Array.isArray(reactionsData)) return;
          setMessages((prev) => mergeReactionsIntoMessages(prev, reactionsData as MessageReactionRow[]));
        })
        .subscribe();
    })();

    return () => {
      supabase.removeChannel(chatMessagesChannel);
      if (reactionsChannel) supabase.removeChannel(reactionsChannel);
    };
  }, [activeChat?.id]);

  // Helper: Garante que o chat existe no banco antes de enviar
  const ensureChatExists = async (): Promise<number | null> => {
     if (!activeChat) return null;
     
     // Se já é ID numérico (ou string numérica válida que não começa com new_), retorna ele
     if (activeChat.id && !String(activeChat.id).startsWith('new_')) {
        return Number(activeChat.id);
     }

     // Se for 'new_...', verifica ou cria
     const cleanPhone = activeChat.phone.replace(/\D/g, '');

     // 1. Verifica se já criaram esse chat (concorrência)
     const { data: existing } = await supabase
        .from('chats')
        .select('id')
        .eq('phone', cleanPhone)
        .maybeSingle();
     
     if (existing) {
         currentChatIdRef.current = existing.id;
         return existing.id;
     }

     // 2. Cria o chat
     const { data: newChat, error } = await supabase
        .from('chats')
        .insert({
           phone: cleanPhone,
           contact_name: activeChat.contact_name || cleanPhone,
           status: 'ACTIVE',
           created_at: new Date().toISOString(),
           last_interaction_at: new Date().toISOString(),
           unread_count: 0
        })
        .select()
        .single();

    if (error) {
        const details = getErrorMessage(error);
        console.error("Erro ao criar chat:", details, error);
        throw new Error(`Falha ao criar chat: ${details}`);
     }
     
     currentChatIdRef.current = newChat.id;
     return newChat.id;
  };

  // 2. Enviar Mensagem de Texto
  const sendMessage = async (text: string, options?: SendMessageOptions) => {
    if (!text.trim() || !activeChat) return;
    setIsSendingMsg(true);

    try {
        // --- PASSO CRÍTICO: Resolve o ID real do chat ---
        const realChatId = await ensureChatExists();
        if (!realChatId) throw new Error("Não foi possível resolver o ID do chat.");

        // Insere no Banco com o ID REAL
        const replyTo = options?.replyTo ?? null;
        const replyToolData = replyTo?.wpp_id
          ? {
              reply_to: {
                wpp_id: replyTo.wpp_id,
                message_text: replyTo.message_text || '',
                message_type: replyTo.message_type || 'text',
                sender: replyTo.sender || '',
              },
            }
          : null;

        const baseInsertPayload = {
          chat_id: realChatId,
          phone: activeChat.phone,
          message_text: text,
          sender: 'HUMAN_AGENT',
          message_type: 'text',
          status: 'sent',
          tool_data: { source: 'manual_chat' },
        } as Record<string, unknown>;

        const extendedInsertPayload = {
          ...baseInsertPayload,
          ...(replyTo?.wpp_id ? { quoted_wpp_id: replyTo.wpp_id } : {}),
          ...(replyToolData
            ? {
                tool_data: {
                  ...(baseInsertPayload.tool_data as Record<string, unknown>),
                  ...(replyToolData as Record<string, unknown>),
                },
              }
            : {}),
        };

        let { data: realMsg, error } = await supabase
          .from('chat_messages')
          .insert(extendedInsertPayload)
          .select()
          .single();

        // Fallback de compatibilidade para bancos ainda sem colunas novas.
        if (error && (replyTo?.wpp_id || replyToolData)) {
          const details = getErrorMessage(error).toLowerCase();
          const isSchemaError =
            details.includes('quoted_wpp_id') ||
            details.includes('tool_data') ||
            details.includes('column') ||
            details.includes('schema cache');

          if (isSchemaError) {
            const retry = await supabase
              .from('chat_messages')
              .insert(baseInsertPayload)
              .select()
              .single();
            realMsg = retry.data;
            error = retry.error;
          }
        }

        if (error) {
          throw new Error(`Falha ao salvar mensagem no banco: ${getErrorMessage(error)}`);
        }

        // Se o chat era temporário, a subscription do useEffect ainda está ouvindo o ID antigo.
        // Forçamos um fetch manual para atualizar a tela imediatamente.
        if (String(activeChat.id).startsWith('new_')) {
            const { data: updatedMsgs } = await supabase
                .from('chat_messages')
                .select('*')
                .eq('chat_id', realChatId)
                .order('created_at', { ascending: true });
            if (updatedMsgs) {
              setMessages(updatedMsgs);
              const toCache = updatedMsgs.length > MAX_CACHED_MESSAGES_PER_CHAT
                ? updatedMsgs.slice(-MAX_CACHED_MESSAGES_PER_CHAT)
                : updatedMsgs;
              set(`chat_messages_${realChatId}`, toCache, TTL_MESSAGES_MS);
              touchMessagesCacheKey(realChatId);
            }
        } else {
            // Para chats existentes, adiciona a mensagem imediatamente (optimistic UI)
            // A subscription vai confirmar depois, mas isso evita delay
            if (realMsg) {
                setMessages(prev => {
                    // Evita duplicatas
                    if (prev.some(m => m.id === realMsg.id)) return prev;
                    return [...prev, realMsg as Message];
                });
            }
        }

        // Dispara API do WhatsApp em background (não bloqueia)
        if (realMsg) {
            const cleanPhone = activeChat.phone.replace(/\D/g, '');
            const remoteJid = `${cleanPhone}@s.whatsapp.net`;
            fetch('/api/whatsapp/send', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ 
                    chatId: realChatId, // ID correto
                    phone: activeChat.phone, 
                    message: text, 
                    type: 'text', 
                    dbMessageId: realMsg.id,
                    messageSource: 'manual_chat',
                    ...(replyTo?.wpp_id
                      ? {
                          replyTo: {
                            wppId: replyTo.wpp_id,
                            remoteJid,
                            fromMe:
                              replyTo.sender === 'HUMAN_AGENT' ||
                              replyTo.sender === 'me',
                            quotedText: replyTo.message_text || '',
                            message_type: replyTo.message_type || 'text',
                            sender: replyTo.sender || '',
                          },
                        }
                      : {}),
                }), 
            }).catch(err => {
                console.error('Erro ao enviar via WhatsApp API:', err);
                // Não bloqueia a UI, apenas loga o erro
            });
        }
    } catch (e) {
        const errorMessage = getErrorMessage(e);
        console.error("Erro ao enviar mensagem:", errorMessage, e);
        throw new Error(errorMessage); // Re-throw para o ChatWindow tratar
    } finally {
        setIsSendingMsg(false);
    }
  };

  const editMessage = async (msg: Message, newText: string) => {
    const normalizedText = newText.trim();
    if (!normalizedText || !activeChat) return;

    const prevMessage = messages.find((m) => m.id === msg.id);
    const resolvedPhone =
      activeChat.phone ||
      msg.phone ||
      prevMessage?.phone ||
      '';
    const resolvedWppId =
      (typeof msg.wpp_id === 'string' && msg.wpp_id.trim()) ||
      (typeof prevMessage?.wpp_id === 'string' && prevMessage.wpp_id.trim()) ||
      (typeof msg.tool_data?.wpp_id === 'string' && msg.tool_data.wpp_id.trim()) ||
      (typeof prevMessage?.tool_data?.wpp_id === 'string' &&
        prevMessage.tool_data.wpp_id.trim()) ||
      '';
    const previousToolData =
      prevMessage?.tool_data && typeof prevMessage.tool_data === 'object'
        ? prevMessage.tool_data
        : {};

    setMessages((prev) =>
      prev.map((m) =>
        m.id === msg.id
          ? {
              ...m,
              message_text: normalizedText,
              is_edited: true,
              edited_at: new Date().toISOString(),
              tool_data: {
                ...previousToolData,
                is_edited: true,
                edited_at: new Date().toISOString(),
              },
            }
          : m
      )
    );

    try {
      const response = await fetch('/api/whatsapp/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: msg.id,
          wppId: resolvedWppId || null,
          phone: resolvedPhone,
          newText: normalizedText,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const details =
          (typeof data?.details === 'string' && data.details) ||
          (typeof data?.details === 'object' ? JSON.stringify(data.details) : '');
        throw new Error(
          [data?.error || 'Erro ao editar mensagem', details].filter(Boolean).join(' - ')
        );
      }
      if (data?.skippedNoWppId) {
        toast.info('Mensagem editada localmente. Ainda não foi sincronizada no WhatsApp.');
      } else {
        toast.success('Mensagem editada');
      }
    } catch (error) {
      console.error('Erro ao editar mensagem:', error);
      toast.error('Não foi possível editar a mensagem');
      if (prevMessage) {
        setMessages((prev) => prev.map((m) => (m.id === prevMessage.id ? prevMessage : m)));
      }
      throw error;
    }
  };

  const reactToMessage = useCallback(async (msg: Message, emoji: string) => {
    if (!activeChat) return;
    const wppId = String((msg as any).wpp_id || '').trim();
    if (!wppId) {
      toast.info('Essa mensagem ainda não possui ID no WhatsApp.');
      return;
    }

    const cleanPhone = String(activeChat.phone || '').replace(/\D/g, '');
    const remoteJid = cleanPhone ? `${cleanPhone}@s.whatsapp.net` : '';
    const targetFromMe =
      msg.sender === 'HUMAN_AGENT' || msg.sender === 'AI_AGENT' || msg.sender === 'me';

    const response = await fetch('/api/whatsapp/reaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messageWppId: wppId,
        remoteJid,
        targetFromMe,
        reaction: String(emoji || '').trim(),
      }),
    }).catch(() => null);

    if (!response || !response.ok) {
      toast.error('Não foi possível enviar a reação');
    }
  }, [activeChat, toast]);

  // 3. Deletar Mensagem
  const deleteMessage = async (msg: Message, deleteForEveryone: boolean) => {
      const msgId = msg.id;
      const isPending = typeof msgId === 'string' && (String(msgId).startsWith('pending_') || String(msgId).startsWith('temp_'));

      // Se for mensagem pendente: encontrar a real correspondente em messages
      let targetMsg: Message = msg;
      if (isPending) {
        const pTime = new Date(msg.created_at).getTime();
        const pText = (msg.message_text || '').trim();
        const real = messages.find(
          (m) =>
            (m.sender === 'HUMAN_AGENT' || m.sender === 'me') &&
            (m.message_text || '').trim() === pText &&
            Math.abs(new Date(m.created_at).getTime() - pTime) < 3000
        );
        if (real) {
          targetMsg = real;
        } else {
          // Pendente sem real ainda: só remove da UI
          onRemovePending?.(String(msgId));
          toast.info('Mensagem removida. Aguarde o envio concluir para apagar no WhatsApp.');
          return;
        }
      }

      try {
          if (deleteForEveryone) {
            setMessages(prev => prev.map(m =>
              m.id === targetMsg.id ? { ...m, message_type: 'revoked', message_text: '', media_url: undefined } : m
            ));
          } else {
            if (activeChat?.id) getDeletedSetForChat(activeChat.id).add(targetMsg.id);
            setMessages(prev => prev.filter(m => m.id !== targetMsg.id));
          }

          if (isPending) onRemovePending?.(String(msgId));

          if (!deleteForEveryone && msg.media_url && !msg.media_url.includes('undefined')) {
             try {
                 const u = msg.media_url.split('/');
                 const f = u[u.length-1];
                 if (f) await supabase.storage.from('midia').remove([decodeURIComponent(f)]);
             } catch (err) {}
          }

          const phone = activeChat?.phone || (msg as any).phone || (targetMsg as any).phone || '';
          const wppId = (targetMsg as any).wpp_id;

          const res = await fetch('/api/whatsapp/delete', {
              method: 'POST',
              headers: {'Content-Type':'application/json'},
              body: JSON.stringify({
                  messageId: targetMsg.id,
                  wppId: wppId || null,
                  target: deleteForEveryone ? 'everyone' : 'system',
                  phone
              })
          });

          const data = await res.json().catch(() => ({}));

          if (!res.ok) {
            toast.error(data?.error || 'Erro ao apagar mensagem');
            if (deleteForEveryone) {
              setMessages(prev => prev.map(m => m.id === targetMsg.id ? targetMsg : m));
            } else {
              if (activeChat?.id) getDeletedSetForChat(activeChat.id).delete(targetMsg.id);
              setMessages(prev => prev.some(m => m.id === targetMsg.id) ? prev : [...prev, targetMsg].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
            }
            return;
          }

          if (deleteForEveryone) {
            onRemovePendingForRevoked?.(targetMsg.created_at);
            if (data.whatsappDeleted) {
              toast.success('Mensagem apagada para todos');
            } else if (data.skippedNoWppId) {
              toast.info('Mensagem removida aqui. Aguarde o envio ao WhatsApp concluir para apagar para todos.');
            } else {
              toast.info('Mensagem removida aqui. Não foi possível apagar no WhatsApp.');
            }
          }
      } catch (e) {
          console.error(e);
          toast.error('Erro ao apagar mensagem');
          if (deleteForEveryone) {
            setMessages(prev => prev.map(m => m.id === targetMsg.id ? targetMsg : m));
          } else {
            if (activeChat?.id) getDeletedSetForChat(activeChat.id).delete(targetMsg.id);
            setMessages(prev => prev.some(m => m.id === targetMsg.id) ? prev : [...prev, targetMsg].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
          }
      }
  };

  return { 
    messages, 
    setMessages, 
    loading, 
    isSendingMsg, 
    sendMessage, 
    deleteMessage,
    editMessage,
    reactToMessage,
  };
}