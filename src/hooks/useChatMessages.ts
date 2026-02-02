import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Chat, Message } from '@/types';

export function useChatMessages(activeChat: Chat | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSendingMsg, setIsSendingMsg] = useState(false);
  
  // Ref para guardar o ID real caso ele mude de 'new_...' para número durante a sessão
  const currentChatIdRef = useRef<number | string | null>(null);

  // Sincroniza o Ref com o activeChat sempre que o componente pai mudar o chat selecionado
  useEffect(() => {
    if (activeChat) {
      currentChatIdRef.current = activeChat.id;
    }
  }, [activeChat?.id]);

  // 1. Carregar Mensagens e Inscrever no Realtime
  useEffect(() => {
    if (!activeChat) {
      setMessages([]);
      return;
    }

    // CORREÇÃO: Usamos String() para garantir que o TS não reclame
    // que 'startsWith' não existe em number.
    const isTempChat = String(activeChat.id).startsWith('new_');
    
    if (isTempChat) {
        setMessages([]);
        return;
    }

    setLoading(true);

    // Fetch inicial
    const fetchMsgs = async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('chat_id', activeChat.id)
        .order('created_at', { ascending: true });
      
      if (!error) {
        setMessages(data || []);
      }
      setLoading(false);
    };

    fetchMsgs();

    // Realtime Subscription
    const channel = supabase.channel(`chat_realtime_${activeChat.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'chat_messages', 
        filter: `chat_id=eq.${activeChat.id}` 
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as Message;
            setMessages(prev => { 
                // Evita duplicatas
                if (prev.some(m => m.id === newMsg.id)) return prev;
                // Adiciona a nova mensagem
                return [...prev, newMsg]; 
            });
        }
        else if (payload.eventType === 'DELETE') { 
            setMessages(prev => prev.filter(msg => msg.id !== payload.old.id)); 
        }
        else if (payload.eventType === 'UPDATE') { 
            setMessages(prev => prev.map(msg => msg.id === payload.new.id ? payload.new as Message : msg)); 
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
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
         console.error("Erro ao criar chat:", error);
         throw error;
     }
     
     currentChatIdRef.current = newChat.id;
     return newChat.id;
  };

  // 2. Enviar Mensagem de Texto
  const sendMessage = async (text: string) => {
    if (!text.trim() || !activeChat) return;
    setIsSendingMsg(true);

    try {
        // --- PASSO CRÍTICO: Resolve o ID real do chat ---
        const realChatId = await ensureChatExists();
        if (!realChatId) throw new Error("Não foi possível resolver o ID do chat.");

        // Insere no Banco com o ID REAL
        const { data: realMsg, error } = await supabase.from('chat_messages')
            .insert({ 
                chat_id: realChatId, // Usa o ID numérico correto
                phone: activeChat.phone, 
                message_text: text, 
                sender: 'HUMAN_AGENT', 
                message_type: 'text' 
            })
            .select()
            .single();

        if (error) throw error;

        // Se o chat era temporário, a subscription do useEffect ainda está ouvindo o ID antigo.
        // Forçamos um fetch manual para atualizar a tela imediatamente.
        if (String(activeChat.id).startsWith('new_')) {
            const { data: updatedMsgs } = await supabase
                .from('chat_messages')
                .select('*')
                .eq('chat_id', realChatId)
                .order('created_at', { ascending: true });
            if (updatedMsgs) setMessages(updatedMsgs);
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
            fetch('/api/whatsapp/send', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ 
                    chatId: realChatId, // ID correto
                    phone: activeChat.phone, 
                    message: text, 
                    type: 'text', 
                    dbMessageId: realMsg.id 
                }), 
            }).catch(err => {
                console.error('Erro ao enviar via WhatsApp API:', err);
                // Não bloqueia a UI, apenas loga o erro
            });
        }
    } catch (e) {
        console.error("Erro ao enviar mensagem", e);
        throw e; // Re-throw para o ChatWindow tratar
    } finally {
        setIsSendingMsg(false);
    }
  };

  // 3. Deletar Mensagem
  const deleteMessage = async (msg: Message, deleteForEveryone: boolean) => {
      try {
          // Otimista: remove da UI na hora
          setMessages(prev => prev.filter(m => m.id !== msg.id));

          // Se tiver mídia, tenta apagar do storage
          if (msg.media_url && !msg.media_url.includes('undefined')) {
             try { 
                 const u = msg.media_url.split('/'); 
                 const f = u[u.length-1]; 
                 if(f) await supabase.storage.from('midia').remove([decodeURIComponent(f)]); 
             } catch(err){} 
          }

          // Chama API para deletar
          await fetch('/api/whatsapp/delete', {
              method: 'POST',
              headers: {'Content-Type':'application/json'},
              body: JSON.stringify({ 
                  messageId: msg.id, 
                  wppId: (msg as any).wpp_id, 
                  target: deleteForEveryone ? 'everyone' : 'system' 
              })
          });
          
          // Remove do banco também para garantir
          await supabase.from('chat_messages').delete().eq('id', msg.id);

      } catch(e) { 
          console.error(e);
          alert("Erro ao apagar mensagem"); 
      }
  };

  return { 
    messages, 
    setMessages, 
    loading, 
    isSendingMsg, 
    sendMessage, 
    deleteMessage 
  };
}