import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import { get, set, TTL_CHATS_LIST_MS, TTL_TAGS_MS } from '@/lib/chatCache';
import { Chat } from '@/types';
import { TagData } from '@/utils/sidebarUtils';

const DEBUG_LOG_ENDPOINT = "http://127.0.0.1:7242/ingest/4058191e-4081-4adb-b80d-3c22067fcea5";
const debugLog = (payload: Record<string, unknown>) =>
  fetch(DEBUG_LOG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {});

export interface UseChatListOptions {
  confirm?: (message: string, title?: string) => Promise<boolean>;
}

// ADICIONADO: isViewingDrafts como parâmetro do hook
export function useChatList(isViewingArchived: boolean, isViewingDrafts: boolean, searchTerm: string, options?: UseChatListOptions) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [tags, setTags] = useState<TagData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const sortChats = (chatsList: Chat[]): Chat[] => {
    return [...chatsList].sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;

      const dateA = new Date(a.last_interaction_at || 0).getTime();
      const dateB = new Date(b.last_interaction_at || 0).getTime();
      return dateB - dateA;
    });
  };

  // ADICIONADO: Cache key agora inclui o estado de drafts para evitar mistura de dados
  const chatsListCacheKey = `chats_list_${isViewingArchived}_${isViewingDrafts}_${searchTerm || ''}`;
  const tagsCacheKey = 'chats_tags';

  useEffect(() => {
    set(chatsListCacheKey, chats, TTL_CHATS_LIST_MS);
  }, [chats, chatsListCacheKey]);

  useEffect(() => {
    set(tagsCacheKey, tags, TTL_TAGS_MS);
  }, [tags]);

  // --- BUSCA INICIAL E FILTROS ---
  const fetchChats = async (showLoading = true) => {
    try {
      if (showLoading) setIsLoading(true);
      
      let query = supabase
        .from('chats')
        .select('*')
        .eq('is_archived', isViewingArchived);

      // ADICIONADO: Filtro que traz apenas os chats que possuem rascunho da IA
      if (isViewingDrafts) {
        query = query.not('ai_draft_reply', 'is', null);
      }

      if (searchTerm) {
        query = query.or(`contact_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`);
      }

      const { data } = await query;
      const sortedChats = sortChats(data || []);
      
      debugLog({
        runId: 'pre-fix',
        hypothesisId: 'H2',
        location: 'useChatList.ts:fetchChats-after-query',
        message: 'Fetched chats for sidebar',
        data: {
          totalChats: sortedChats.length,
          unreadChats: sortedChats.filter((c) => (c.unread_count || 0) > 0).length,
          sample: sortedChats.slice(0, 5).map((c) => ({
            id: c.id,
            unread: c.unread_count || 0,
            lastInteractionAt: c.last_interaction_at || null,
          })),
        },
        timestamp: Date.now(),
      });
      
      setChats(sortedChats);
      set(chatsListCacheKey, sortedChats, TTL_CHATS_LIST_MS);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTags = async () => {
    const { data } = await supabase.from('tags').select('*').order('name');
    if (data) {
      setTags(data);
      set(tagsCacheKey, data, TTL_TAGS_MS);
    }
  };

  // --- REALTIME SUBSCRIPTIONS ---
  useEffect(() => {
    const cachedChats = get<Chat[]>(chatsListCacheKey);
    const cachedTags = get<TagData[]>(tagsCacheKey);
    const hasValidChatsCache = cachedChats && Array.isArray(cachedChats);
    if (hasValidChatsCache) setChats(cachedChats);
    if (Array.isArray(cachedTags)) setTags(cachedTags);

    fetchChats(!hasValidChatsCache);
    fetchTags();

    const tagsSub = supabase.channel('public:tags')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tags' }, () => fetchTags())
      .subscribe();

    const messagesSub = supabase.channel('public:chat_messages_for_list')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'chat_messages' 
      }, async (payload) => {
        const newMessage = payload.new as any;
        const chatId = newMessage.chat_id;
        const sender = newMessage.sender;
        
        debugLog({
          runId: 'pre-fix',
          hypothesisId: 'H6',
          location: 'useChatList.ts:messagesSub-insert',
          message: 'Client realtime message insert observed',
          data: {
            chatId,
            sender: String(sender || ''),
            messageType: String(newMessage.message_type || ''),
          },
          timestamp: Date.now(),
        });

        const isFromUs = sender === 'HUMAN_AGENT' || sender === 'AI_AGENT' || sender === 'me';
        if (isFromUs) {
          setChats(currentChats => {
            const chatIndex = currentChats.findIndex(c => c.id === chatId);
            if (chatIndex === -1) return currentChats;
            const updatedChats = [...currentChats];
            updatedChats[chatIndex] = {
              ...updatedChats[chatIndex],
              last_message: newMessage.message_text || (newMessage.message_type === 'audio' ? 'Áudio' : 'Mídia'),
              last_message_type: newMessage.message_type || 'text',
              last_message_sender: 'me',
              last_message_status: (newMessage.status as 'sent' | 'delivered' | 'read') || 'sent',
              last_interaction_at: newMessage.created_at || new Date().toISOString(),
            };
            return sortChats(updatedChats);
          });
          return;
        }

        setChats(currentChats => {
          const chatIndex = currentChats.findIndex(c => c.id === chatId);
          if (chatIndex === -1) return currentChats;

          const updatedChats = [...currentChats];
          const chat = updatedChats[chatIndex];
          
          updatedChats[chatIndex] = {
            ...chat,
            last_interaction_at: newMessage.created_at || new Date().toISOString(),
            last_message: newMessage.message_text || '',
            last_message_type: newMessage.message_type || 'text',
            last_message_sender: sender
          };

          return sortChats(updatedChats);
        });
      })
      .subscribe();

    const chatsSub = supabase.channel('public:chats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, (payload) => {
        const { eventType, new: newRecord, old: oldRecord } = payload;
        const unreadBefore = Number((oldRecord as Record<string, unknown> | null)?.unread_count || 0);
        const unreadAfter = Number((newRecord as Record<string, unknown> | null)?.unread_count || 0);
        
        if (eventType === 'UPDATE' && unreadBefore !== unreadAfter) {
          debugLog({
            runId: 'post-fix',
            hypothesisId: 'H7',
            location: 'useChatList.ts:chatsSub-unread-transition',
            message: 'Realtime unread_count transition detected',
            data: {
              chatId: Number((newRecord as Record<string, unknown> | null)?.id || 0),
              unreadBefore,
              unreadAfter,
            },
            timestamp: Date.now(),
          });
        }

        setChats(currentChats => {
          if (eventType === 'DELETE') {
            return currentChats.filter(chat => chat.id !== oldRecord.id);
          }

          if (eventType === 'INSERT') {
            const typedRecord = newRecord as Chat;
            
            // Regras de visualização estritas
            if (!!typedRecord.is_archived !== isViewingArchived) return currentChats;
            if (isViewingDrafts && !typedRecord.ai_draft_reply) return currentChats;

            if (currentChats.some(c => c.id === typedRecord.id)) {
                const updatedList = currentChats.map(c => c.id === typedRecord.id ? typedRecord : c);
                return sortChats(updatedList);
            }
            
            const tempChatIndex = currentChats.findIndex(c => 
                String(c.id).startsWith('new_') && c.phone === typedRecord.phone
            );
            
            if (tempChatIndex !== -1) {
                const updatedList = [...currentChats];
                updatedList[tempChatIndex] = typedRecord;
                return sortChats(updatedList);
            }

            const newList = [typedRecord, ...currentChats];
            return sortChats(newList);
          }

          if (eventType === 'UPDATE') {
            const typedRecord = newRecord as Chat;
            
            // Regras de visualização estritas
            if (!!typedRecord.is_archived !== isViewingArchived) {
                return currentChats.filter(chat => chat.id !== typedRecord.id);
            }
            if (isViewingDrafts && !typedRecord.ai_draft_reply) {
                return currentChats.filter(chat => chat.id !== typedRecord.id);
            }

            const exists = currentChats.some(c => c.id === typedRecord.id);
            if (exists) {
                const updatedList = currentChats.map(chat => chat.id === typedRecord.id ? typedRecord : chat);
                return sortChats(updatedList);
            } else {
                // Caso o chat passe a pertencer a esta lista (ex: ganhou um ai_draft_reply)
                const newList = [typedRecord, ...currentChats];
                return sortChats(newList);
            }
          }
          return currentChats;
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(chatsSub);
      supabase.removeChannel(tagsSub);
      supabase.removeChannel(messagesSub);
    };
  }, [isViewingArchived, isViewingDrafts, searchTerm]); // ADICIONADO: isViewingDrafts nas dependências

  // --- AÇÕES ---

  const handleCreateChat = (newChat: Chat) => {
    const exists = chats.find(c => c.id === newChat.id);
    if (!exists) setChats(prev => [newChat, ...prev]);
    return newChat;
  };

  const handleUpdateContact = (updatedChat: Chat) => {
    setChats(prev => prev.map(c => c.id === updatedChat.id ? updatedChat : c));
  };

  const handleSelectChat = async (chat: Chat) => {
    setChats(prev => prev.map(c => c.id === chat.id ? { ...c, unread_count: 0 } : c));
    
    if ((chat.unread_count || 0) > 0) {
      await fetch('/api/chats/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: chat.id }),
      }).catch((error) => {
        console.error('Erro ao marcar como lida:', error);
      });
    }
  };

  const toggleTagOnChat = async (chat: Chat, tagId: number) => {
    const currentTags = (chat.tags || []) as string[]; 
    const tagIdStr = tagId.toString();
    const newTags = currentTags.includes(tagIdStr) 
      ? currentTags.filter(t => t !== tagIdStr) 
      : [...currentTags, tagIdStr];
    
    setChats(prev => prev.map(c => c.id === chat.id ? { ...c, tags: newTags } : c));
    await supabase.from('chats').update({ tags: newTags }).eq('id', chat.id);
    
    return { ...chat, tags: newTags };
  };

  const setTagsOnChat = async (chat: Chat, tagIds: number[]) => {
    const newTags = tagIds.map(id => id.toString());
    setChats(prev => prev.map(c => c.id === chat.id ? { ...c, tags: newTags } : c));
    await supabase.from('chats').update({ tags: newTags }).eq('id', chat.id);
    return { ...chat, tags: newTags };
  };

  const askConfirm = async (message: string, title?: string): Promise<boolean> => {
    if (options?.confirm) return options.confirm(message, title);
    return window.confirm(message);
  };

  const performAction = async (action: string, chat: Chat) => {
    try {
        const updates: any = {};
        
        if (action === 'pin') updates.is_pinned = !chat.is_pinned;
        if (action === 'archive') updates.is_archived = !chat.is_archived;
        if (action === 'unread') updates.unread_count = (chat.unread_count || 0) > 0 ? 0 : 1;
        if (action === 'block') {
            if (!(await askConfirm("Bloquear contato?", "Bloquear contato"))) return;
            updates.is_blocked = !chat.is_blocked;
        }

        if (action === 'delete') {
            if (!(await askConfirm("Apagar permanentemente esta conversa?", "Excluir conversa"))) return;
            setChats(prev => prev.filter(c => c.id !== chat.id));
            await supabase.from('chat_messages').delete().eq('chat_id', chat.id);
            await supabase.from('chats').delete().eq('id', chat.id);
            return true;
        }

        if (action === 'archive') {
             setChats(prev => prev.filter(c => c.id !== chat.id));
        }
        
        await supabase.from('chats').update(updates).eq('id', chat.id);
        return false;

    } catch (e) {
        console.error("Erro na ação:", e);
        fetchChats();
        return false;
    }
  };

  const handleBulkAction = async (action: 'archive' | 'delete', selectedIds: number[]) => {
      if (selectedIds.length === 0) return false;
      const confirmText = action === 'archive' ? 'arquivar' : 'excluir permanentemente';
      if (!(await askConfirm(`Deseja ${confirmText} as ${selectedIds.length} conversas?`, 'Confirmar ação'))) return false;

      try {
        setChats(prev => prev.filter(c => !selectedIds.includes(c.id)));
        
        if (action === 'archive') {
            await supabase.from('chats').update({ is_archived: true }).in('id', selectedIds);
        } else {
            await supabase.from('chat_messages').delete().in('chat_id', selectedIds);
            await supabase.from('chats').delete().in('id', selectedIds);
        }
        return true;
      } catch (e) {
          console.error(e);
          fetchChats();
          return false;
      }
  };

  return {
    chats,
    tags,
    isLoading,
    fetchTags,
    actions: {
        create: handleCreateChat,
        updateContact: handleUpdateContact,
        select: handleSelectChat,
        toggleTag: toggleTagOnChat,
        setTagsOnChat,
        singleAction: performAction,
        bulkAction: handleBulkAction
    }
  };
}