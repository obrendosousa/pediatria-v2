import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();

export function useUnreadChatsCount() {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [totalChats, setTotalChats] = useState<number>(0);

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        // Busca total de chats não lidos
        const { data: unreadData, error: unreadError } = await supabase
          .from('chats')
          .select('unread_count')
          .eq('is_archived', false)
          .neq('status', 'DELETED');

        if (!unreadError && unreadData) {
          const totalUnread = unreadData.reduce((sum, chat) => sum + (chat.unread_count || 0), 0);
          setUnreadCount(totalUnread);
        }

        // Busca total de chats ativos
        const { count: totalCount, error: totalError } = await supabase
          .from('chats')
          .select('*', { count: 'exact', head: true })
          .eq('is_archived', false)
          .neq('status', 'DELETED');

        if (!totalError && totalCount !== null) {
          setTotalChats(totalCount);
        }
      } catch (error) {
        console.error('Erro ao buscar contagem de chats:', error);
      }
    };

    fetchCounts();

    // Subscribe para atualizações em tempo real
    const channel = supabase
      .channel('chats-count-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chats',
        },
        () => {
          fetchCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { unreadCount, totalChats };
}
