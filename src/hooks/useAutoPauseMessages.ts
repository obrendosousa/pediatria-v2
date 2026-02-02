import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { getPauseConfig, hasChatReceivedAutoMessage } from '@/utils/pauseService';

/**
 * Hook que escuta novas mensagens e dispara mensagem automática
 * quando o modo de pausa está ativo
 */
export function useAutoPauseMessages() {
  const scheduledMessagesRef = useRef<Map<number, NodeJS.Timeout>>(new Map());
  const pauseConfigRef = useRef<{ message: string; sessionId: string } | null>(null);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let checkPauseInterval: NodeJS.Timeout | null = null;

    // Função para verificar e atualizar configuração de pausa
    const updatePauseConfig = async () => {
      const config = await getPauseConfig();
      pauseConfigRef.current = config;
      
      // Se pausa foi desativada, limpar todos os timeouts agendados
      if (!config) {
        scheduledMessagesRef.current.forEach((timeout) => {
          clearTimeout(timeout);
        });
        scheduledMessagesRef.current.clear();
      }
    };

    // Verificar pausa a cada 5 segundos (para detectar mudanças)
    checkPauseInterval = setInterval(updatePauseConfig, 5000);
    updatePauseConfig(); // Verificação inicial

    // Função para enviar mensagem automática
    const sendAutoMessage = async (chatId: number, phone: string, message: string, sessionId: string) => {
      try {
        console.log(`[useAutoPauseMessages] Enviando mensagem automática para chat ${chatId} após 1 minuto`);

        // Inserir mensagem no banco
        const { data: dbMessage, error: insertError } = await supabase
          .from('chat_messages')
          .insert({
            chat_id: chatId,
            phone: phone,
            message_text: message,
            sender: 'HUMAN_AGENT',
            message_type: 'text',
            auto_sent_pause_session: sessionId
          })
          .select()
          .single();

        if (insertError) {
          console.error('[useAutoPauseMessages] Erro ao inserir mensagem:', insertError);
          return;
        }

        // Enviar via API do WhatsApp
        const response = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: chatId,
            phone: phone,
            message: message,
            type: 'text',
            dbMessageId: dbMessage.id
          })
        });

        if (!response.ok) {
          console.error('[useAutoPauseMessages] Erro ao enviar mensagem via API');
        } else {
          console.log(`[useAutoPauseMessages] Mensagem automática enviada com sucesso para chat ${chatId}`);
        }
      } catch (error) {
        console.error('[useAutoPauseMessages] Erro ao enviar mensagem automática:', error);
      }
    };

    // Função para processar nova mensagem recebida
    const handleNewMessage = async (payload: any) => {
      const newMessage = payload.new;
      
      // Verificar se é mensagem do cliente/contato (não do agente)
      const sender = newMessage.sender;
      if (sender === 'HUMAN_AGENT' || sender === 'AI_AGENT' || sender === 'me') {
        return; // Ignorar mensagens enviadas pelo sistema
      }

      const chatId = newMessage.chat_id;
      const phone = newMessage.phone;

      // Validar dados necessários
      if (!chatId || !phone) {
        console.warn('[useAutoPauseMessages] Mensagem sem chat_id ou phone:', newMessage);
        return;
      }

      // Verificar se pausa está ativa
      const config = pauseConfigRef.current;
      if (!config || !config.message || !config.sessionId) {
        return; // Pausa não está ativa
      }

      // Verificar se chat já recebeu mensagem automática nesta sessão
      const alreadyReceived = await hasChatReceivedAutoMessage(chatId, config.sessionId);
      if (alreadyReceived) {
        console.log(`[useAutoPauseMessages] Chat ${chatId} já recebeu mensagem automática nesta sessão`);
        return;
      }

      // Verificar se já existe timeout agendado para este chat
      if (scheduledMessagesRef.current.has(chatId)) {
        console.log(`[useAutoPauseMessages] Já existe mensagem agendada para chat ${chatId}`);
        return;
      }

      // Agendar envio após 1 minuto (60000ms)
      const timeout = setTimeout(() => {
        sendAutoMessage(chatId, phone, config.message, config.sessionId);
        scheduledMessagesRef.current.delete(chatId);
      }, 60000); // 1 minuto

      scheduledMessagesRef.current.set(chatId, timeout);
      console.log(`[useAutoPauseMessages] Mensagem automática agendada para chat ${chatId} (1 minuto)`);
    };

    // Inscrever no canal de mensagens
    channel = supabase
      .channel('auto_pause_messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages'
        },
        handleNewMessage
      )
      .subscribe();

    // Cleanup
    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      if (checkPauseInterval) {
        clearInterval(checkPauseInterval);
      }
      // Limpar todos os timeouts agendados
      scheduledMessagesRef.current.forEach((timeout) => {
        clearTimeout(timeout);
      });
      scheduledMessagesRef.current.clear();
    };
  }, []);
}
