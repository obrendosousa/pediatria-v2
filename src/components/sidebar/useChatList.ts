import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import { get, set, TTL_CHATS_LIST_MS, TTL_TAGS_MS } from '@/lib/chatCache';
import { Chat } from '@/types';
import { TagData } from '@/utils/sidebarUtils';

export interface UseChatListOptions {
  confirm?: (message: string, title?: string) => Promise<boolean>;
}

export function useChatList(isViewingArchived: boolean, searchTerm: string, options?: UseChatListOptions) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [tags, setTags] = useState<TagData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Função de ordenação: Pinned > Unread > Date
  const sortChats = (chatsList: Chat[]): Chat[] => {
    return [...chatsList].sort((a, b) => {
      // 1. Pinned primeiro
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      
      // 2. Chats com mensagens não lidas depois de pinned
      const aUnread = (a.unread_count || 0) > 0;
      const bUnread = (b.unread_count || 0) > 0;
      if (aUnread && !bUnread) return -1;
      if (!aUnread && bUnread) return 1;
      
      // 3. Por data de última interação (mais recente primeiro)
      const dateA = new Date(a.last_interaction_at || 0).getTime();
      const dateB = new Date(b.last_interaction_at || 0).getTime();
      return dateB - dateA;
    });
  };

  const chatsListCacheKey = `chats_list_${isViewingArchived}_${searchTerm || ''}`;
  const tagsCacheKey = 'chats_tags';

  // Mantém o cache quente quando realtime atualiza chats/tags
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

      if (searchTerm) {
        query = query.or(`contact_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`);
      }

      const { data } = await query;
      const sortedChats = sortChats(data || []);
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

    // Canal de Tags
    const tagsSub = supabase.channel('public:tags')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tags' }, () => fetchTags())
      .subscribe();

    // Canal de Mensagens - para detectar novas mensagens e atualizar unread_count
    const messagesSub = supabase.channel('public:chat_messages_for_list')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'chat_messages' 
      }, async (payload) => {
        const newMessage = payload.new as any;
        const chatId = newMessage.chat_id;
        const sender = newMessage.sender;

        const isFromUs = sender === 'HUMAN_AGENT' || sender === 'AI_AGENT' || sender === 'me';
        if (isFromUs) {
          // Mensagem enviada por nós: atualiza preview (checks) na sidebar
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

        // Atualizar unread_count e last_interaction_at do chat (mensagem do cliente)
        setChats(currentChats => {
          const chatIndex = currentChats.findIndex(c => c.id === chatId);
          if (chatIndex === -1) return currentChats;

          const updatedChats = [...currentChats];
          const chat = updatedChats[chatIndex];
          
          // Atualizar chat com nova mensagem
          updatedChats[chatIndex] = {
            ...chat,
            unread_count: (chat.unread_count || 0) + 1,
            last_interaction_at: newMessage.created_at || new Date().toISOString(),
            last_message: newMessage.message_text || '',
            last_message_type: newMessage.message_type || 'text',
            last_message_sender: sender
          };

          // Reordenar: o chat com nova mensagem deve subir
          return sortChats(updatedChats);
        });

        // Atualizar unread_count no banco (async, não bloqueia UI)
        // Buscar o valor atual e incrementar
        supabase
          .from('chats')
          .select('unread_count')
          .eq('id', chatId)
          .single()
          .then(({ data }) => {
            if (data) {
              const currentUnread = data.unread_count || 0;
              void supabase
                .from('chats')
                .update({ 
                  unread_count: currentUnread + 1,
                  last_interaction_at: newMessage.created_at || new Date().toISOString()
                })
                .eq('id', chatId)
                .then(({ error }) => { if (error) console.error(error); });
            }
          })
          .then(undefined, console.error);
      })
      .subscribe();

    // Canal de Chats (Lógica complexa de merge)
    const chatsSub = supabase.channel('public:chats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, (payload) => {
        const { eventType, new: newRecord, old: oldRecord } = payload;

        setChats(currentChats => {
          // 1. DELETE
          if (eventType === 'DELETE') {
            return currentChats.filter(chat => chat.id !== oldRecord.id);
          }

          // 2. INSERT
          if (eventType === 'INSERT') {
            const typedRecord = newRecord as Chat;
            if (!!typedRecord.is_archived !== isViewingArchived) return currentChats;

            // Evita duplicidade (ID exato ou chat temporário)
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

            // Novo chat - adicionar e reordenar
            const newList = [typedRecord, ...currentChats];
            return sortChats(newList);
          }

          // 3. UPDATE
          if (eventType === 'UPDATE') {
            const typedRecord = newRecord as Chat;
            
            // Se mudou o status de arquivado, remove/adiciona conforme a view atual
            if (!!typedRecord.is_archived !== isViewingArchived) {
                return currentChats.filter(chat => chat.id !== typedRecord.id);
            }

            const exists = currentChats.some(c => c.id === typedRecord.id);
            if (exists) {
                const updatedList = currentChats.map(chat => chat.id === typedRecord.id ? typedRecord : chat);
                // Reordena usando função customizada: Pinned > Unread > Date
                return sortChats(updatedList);
            } else {
                // Veio de outro estado (ex: desarquivou)
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
  }, [isViewingArchived, searchTerm]); // Recria se mudar visualização ou busca

  // --- AÇÕES (EXPOSTAS PARA A UI) ---

  const handleCreateChat = (newChat: Chat) => {
    const exists = chats.find(c => c.id === newChat.id);
    if (!exists) setChats(prev => [newChat, ...prev]);
    return newChat;
  };

  const handleUpdateContact = (updatedChat: Chat) => {
    setChats(prev => prev.map(c => c.id === updatedChat.id ? updatedChat : c));
  };

  const handleSelectChat = async (chat: Chat) => {
    // Zera contador visualmente
    setChats(prev => prev.map(c => c.id === chat.id ? { ...c, unread_count: 0 } : c));
    
    if ((chat.unread_count || 0) > 0) {
      await supabase.from('chats').update({ unread_count: 0 }).eq('id', chat.id);
    }
  };

  const toggleTagOnChat = async (chat: Chat, tagId: number) => {
    const currentTags = (chat.tags || []) as string[]; 
    const tagIdStr = tagId.toString();
    const newTags = currentTags.includes(tagIdStr) 
      ? currentTags.filter(t => t !== tagIdStr) 
      : [...currentTags, tagIdStr];
    
    // Otimista
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
            setChats(prev => prev.filter(c => c.id !== chat.id)); // Remove da UI
            await supabase.from('chat_messages').delete().eq('chat_id', chat.id);
            await supabase.from('chats').delete().eq('id', chat.id);
            return;
        }

        // Aplica update no banco (UI atualiza via Realtime ou Otimista se quiser implementar complexidade extra)
        // Aqui confiamos no Realtime para reordenar, mas podemos fazer otimista simples:
        if (action === 'archive') {
             setChats(prev => prev.filter(c => c.id !== chat.id));
        }
        
        await supabase.from('chats').update(updates).eq('id', chat.id);

    } catch (e) {
        console.error("Erro na ação:", e);
        fetchChats(); // Reverte em caso de erro
    }
  };

  const handleBulkAction = async (action: 'archive' | 'delete', selectedIds: number[]) => {
      if (selectedIds.length === 0) return;
      const confirmText = action === 'archive' ? 'arquivar' : 'excluir permanentemente';
      if (!(await askConfirm(`Deseja ${confirmText} as ${selectedIds.length} conversas?`, 'Confirmar ação'))) return;

      try {
        // Otimista
        setChats(prev => prev.filter(c => !selectedIds.includes(c.id)));
        
        if (action === 'archive') {
            await supabase.from('chats').update({ is_archived: true }).in('id', selectedIds);
        } else {
            await supabase.from('chat_messages').delete().in('chat_id', selectedIds);
            await supabase.from('chats').delete().in('id', selectedIds);
        }
      } catch (e) {
          console.error(e);
          fetchChats();
      }
  };

  return {
    chats,
    tags,
    isLoading,
    fetchTags, // Exposto caso precise forçar refresh
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