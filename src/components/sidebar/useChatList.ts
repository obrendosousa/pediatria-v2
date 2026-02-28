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

  const sortChats = (chatsList: Chat[]): Chat[] => {
    return [...chatsList].sort((a, b) => {
      // 1. IA SEMPRE NO TOPO ABSOLUTO
      const isAiA = a.phone === '00000000000';
      const isAiB = b.phone === '00000000000';
      if (isAiA && !isAiB) return -1;
      if (!isAiA && isAiB) return 1;

      // 2. Fixados depois da IA
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;

      // 3. Ordem cronológica
      const dateA = new Date(a.last_interaction_at || 0).getTime();
      const dateB = new Date(b.last_interaction_at || 0).getTime();
      return dateB - dateA;
    });
  };

  const chatsListCacheKey = `chats_list_${isViewingArchived}_${searchTerm || ''}`;
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



      if (searchTerm) {
        query = query.or(`contact_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      let fetchedData = data || [];

      // --- AUTO-CRIAÇÃO DO CHAT DA IA ---
      // Só injeta se estivermos na visualização principal (sem filtros ativos)
      if (!isViewingArchived && !searchTerm) {
        const aiChatExists = fetchedData.some(c => c.phone === '00000000000');
        if (!aiChatExists) {
          // Tenta buscar no banco caso tenha ficado de fora da paginação (se houver no futuro)
          const { data: existingAi } = await supabase.from('chats').select('*').eq('phone', '00000000000').maybeSingle();

          if (existingAi) {
            fetchedData.push(existingAi);
          } else {
            // Cria o chat da IA permanentemente no banco
            const { data: newAi } = await supabase.from('chats').insert({
              phone: '00000000000',
              contact_name: '🤖 Assistente Copiloto',
              is_pinned: true,
              unread_count: 0
            }).select().single();

            if (newAi) {
              fetchedData.push(newAi);
            }
          }
        }
      }
      // ----------------------------------

      const sortedChats = sortChats(fetchedData);

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
              last_message_sender: sender, // Correção aqui para identificar IA_AGENT
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

        setChats(currentChats => {
          if (eventType === 'DELETE') {
            return currentChats.filter(chat => chat.id !== oldRecord.id);
          }

          if (eventType === 'INSERT') {
            const typedRecord = newRecord as Chat;

            if (!!typedRecord.is_archived !== isViewingArchived) return currentChats;

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

            if (!!typedRecord.is_archived !== isViewingArchived) {
              return currentChats.filter(chat => chat.id !== typedRecord.id);
            }

            const exists = currentChats.some(c => c.id === typedRecord.id);
            if (exists) {
              const updatedList = currentChats.map(chat => chat.id === typedRecord.id ? typedRecord : chat);
              return sortChats(updatedList);
            } else {
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
  }, [isViewingArchived, searchTerm]);

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
    // PROTEÇÃO: Impede ações destrutivas contra a IA
    if (chat.phone === '00000000000' && (action === 'block' || action === 'delete' || action === 'archive')) {
      alert("Operação não permitida no chat do Assistente IA.");
      return false;
    }

    try {
      if (action === 'delete') {
        if (!(await askConfirm("Apagar permanentemente esta conversa?", "Excluir conversa"))) return false;
        setChats(prev => prev.filter(c => c.id !== chat.id));
        await supabase.from('chat_messages').delete().eq('chat_id', chat.id);
        await supabase.from('chats').delete().eq('id', chat.id);
        return true;
      }

      const updates: any = {};

      if (action === 'pin') {
        const newPinned = !chat.is_pinned;
        updates.is_pinned = newPinned;
        // Atualização otimista: reflete o estado imediatamente na UI
        setChats(prev => sortChats(prev.map(c => c.id === chat.id ? { ...c, is_pinned: newPinned } : c)));
      }

      if (action === 'archive') {
        updates.is_archived = !chat.is_archived;
        // Remove da lista atual imediatamente (seja arquivando ou desarquivando)
        setChats(prev => prev.filter(c => c.id !== chat.id));
      }

      if (action === 'unread') {
        const newCount = (chat.unread_count || 0) > 0 ? 0 : 1;
        updates.unread_count = newCount;
        // Atualização otimista: reflete o contador imediatamente na UI
        setChats(prev => prev.map(c => c.id === chat.id ? { ...c, unread_count: newCount } : c));
      }

      if (action === 'block') {
        if (!(await askConfirm("Bloquear contato?", "Bloquear contato"))) return false;
        const newBlocked = !chat.is_blocked;
        updates.is_blocked = newBlocked;
        setChats(prev => prev.map(c => c.id === chat.id ? { ...c, is_blocked: newBlocked } : c));
      }

      if (Object.keys(updates).length === 0) return false;

      await supabase.from('chats').update(updates).eq('id', chat.id);
      // Retorna true para archive para que o ChatWindow seja limpo ao arquivar o chat selecionado
      return action === 'archive';

    } catch (e) {
      console.error("Erro na ação:", e);
      fetchChats();
      return false;
    }
  };

  const handleBulkAction = async (action: 'archive' | 'delete', selectedIds: number[]) => {
    // PROTEÇÃO: Filtra a IA para que ela não seja deletada em massa
    const aiChat = chats.find(c => c.phone === '00000000000');
    let validIds = selectedIds;

    if (aiChat && selectedIds.includes(aiChat.id)) {
      validIds = selectedIds.filter(id => id !== aiChat.id);
      if (validIds.length === 0) {
        alert("Operação não permitida no chat do Assistente IA.");
        return false;
      }
    }

    if (validIds.length === 0) return false;
    const confirmText = action === 'archive' ? 'arquivar' : 'excluir permanentemente';
    if (!(await askConfirm(`Deseja ${confirmText} as ${validIds.length} conversas?`, 'Confirmar ação'))) return false;

    try {
      setChats(prev => prev.filter(c => !validIds.includes(c.id)));

      if (action === 'archive') {
        await supabase.from('chats').update({ is_archived: true }).in('id', validIds);
      } else {
        await supabase.from('chat_messages').delete().in('chat_id', validIds);
        await supabase.from('chats').delete().in('id', validIds);
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