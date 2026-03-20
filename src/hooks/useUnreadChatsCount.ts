import { useState, useEffect, useRef, useMemo } from 'react';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import { createClient } from '@/lib/supabase/client';

/**
 * Hook genérico que conta chats não lidos de um schema específico.
 * @param schema - 'public' para Pediatria, 'atendimento' para Clínica Geral
 */
function useUnreadChatsCountForSchema(schema: 'public' | 'atendimento') {
  const supabase = useMemo(
    () => schema === 'public' ? createClient() : createSchemaClient(schema),
    [schema]
  );
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
        console.error(`Erro ao buscar contagem de chats (${schema}):`, error);
      }
    };

    fetchCounts();

    const channel = supabase
      .channel(`${schema}-chats-unread`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema,
          table: 'chats',
        },
        () => {
          fetchCounts();
        }
      )
      .subscribe();

    intervalRef.current = setInterval(fetchCounts, 5000);

    return () => {
      supabase.removeChannel(channel);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema]);

  return { unreadCount, totalChats };
}

/** Conta chats não lidos do schema atendimento (Clínica Geral) */
export function useUnreadChatsCount() {
  return useUnreadChatsCountForSchema('atendimento');
}

/** Conta chats não lidos do schema public (Pediatria) */
export function useUnreadChatsCountPediatria() {
  return useUnreadChatsCountForSchema('public');
}
