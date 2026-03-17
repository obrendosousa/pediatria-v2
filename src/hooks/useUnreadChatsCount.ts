import { useState, useEffect, useRef } from 'react';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
const supabase = createSchemaClient('atendimento');

export function useUnreadChatsCount() {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [totalChats, setTotalChats] = useState<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const { data: unreadData, error: unreadError } = await supabase
          .from('chats')
          .select('id')
          .eq('is_archived', false)
          .neq('status', 'DELETED')
          .gt('unread_count', 0)
          .limit(5000);

        if (!unreadError && unreadData) {
          setUnreadCount(unreadData.length);
        }

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

    // Realtime: escuta mudanças no schema atendimento
    const channel = supabase
      .channel('atd-chats-unread')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'atendimento',
          table: 'chats',
        },
        () => {
          fetchCounts();
        }
      )
      .subscribe();

    // Polling fallback a cada 5s (caso realtime falhe ou demore)
    intervalRef.current = setInterval(fetchCounts, 5000);

    return () => {
      supabase.removeChannel(channel);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { unreadCount, totalChats };
}
