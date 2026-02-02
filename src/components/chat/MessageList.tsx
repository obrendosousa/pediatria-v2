import { useEffect, useRef, useMemo, useCallback } from 'react';
import { Message, Chat } from '@/types';
import MessageBubble from './MessageBubble';

interface MessageListProps {
  messages: Message[];
  pendingMessages: any[];
  chat: Chat;
  onDelete: (msg: Message, deleteForEveryone: boolean) => void;
  onSaveMacro: (text: string) => void;
  onPreviewImage: (url: string) => void;
}

export default function MessageList({ 
  messages, 
  pendingMessages,
  chat, 
  onDelete,
  onSaveMacro,
  onPreviewImage 
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const lastMessageCountRef = useRef(0);

  // Memoizar todas as mensagens combinadas
  const allMessages = useMemo(() => [...messages, ...pendingMessages], [messages, pendingMessages]);

  // Memoizar data de hoje para evitar recriação
  const todayDateString = useMemo(() => new Date().toLocaleDateString(), []);

  // Auto-scroll inteligente - apenas quando novas mensagens chegam
  useEffect(() => {
    const newMessageCount = allMessages.length;
    const hadNewMessages = newMessageCount > lastMessageCountRef.current;
    lastMessageCountRef.current = newMessageCount;

    // Só faz scroll se:
    // 1. Houve novas mensagens
    // 2. O usuário não está scrollado para cima (dentro de 200px do bottom)
    if (hadNewMessages && shouldAutoScrollRef.current && bottomRef.current) {
      // Usar requestAnimationFrame para melhor performance
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      });
    }
  }, [allMessages.length]);

  // Detectar quando usuário scrolla para cima (desabilitar auto-scroll)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      // Se está mais de 200px do bottom, usuário está scrollando para cima
      shouldAutoScrollRef.current = distanceFromBottom < 200;
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Memoizar callbacks para evitar re-renders desnecessários
  const handleDelete = useCallback((msg: Message, deleteForEveryone: boolean) => {
    onDelete(msg, deleteForEveryone);
  }, [onDelete]);

  const handleSaveMacro = useCallback((text: string) => {
    onSaveMacro(text);
  }, [onSaveMacro]);

  const handlePreviewImage = useCallback((url: string) => {
    onPreviewImage(url);
  }, [onPreviewImage]);

  // Memoizar renderização das mensagens
  const renderedMessages = useMemo(() => {
    return allMessages.map((msg, index) => {
      const prevMsg = allMessages[index - 1];
      const nextMsg = allMessages[index + 1];

      // --- Lógica de Data (memoizada) ---
      const currentDate = new Date(msg.created_at).toLocaleDateString();
      const prevDate = prevMsg ? new Date(prevMsg.created_at).toLocaleDateString() : null;
      const showDateDivider = currentDate !== prevDate;

      // --- Lógica de Sequência (Grouping) ---
      const isMe = msg.sender === 'me' || msg.sender === 'HUMAN_AGENT';
      const isPrevSameSender = prevMsg && (prevMsg.sender === 'me' || prevMsg.sender === 'HUMAN_AGENT') === isMe;
      const isNextSameSender = nextMsg && (nextMsg.sender === 'me' || nextMsg.sender === 'HUMAN_AGENT') === isMe;

      // Define a posição na sequência para ajustar bordas
      let sequencePosition: 'single' | 'first' | 'middle' | 'last' = 'single';
      if (isPrevSameSender && isNextSameSender) sequencePosition = 'middle';
      else if (!isPrevSameSender && isNextSameSender) sequencePosition = 'first';
      else if (isPrevSameSender && !isNextSameSender) sequencePosition = 'last';

      const showAvatar = !isMe && (sequencePosition === 'last' || sequencePosition === 'single');

      // Adicionar delay progressivo para animação em cascata (apenas para novas mensagens)
      const isNewMessage = index >= allMessages.length - 3; // Últimas 3 mensagens
      const animationDelay = isNewMessage ? (allMessages.length - 1 - index) * 0.03 : 0;
      
      return (
        <div 
          key={msg.id || `msg-${index}`}
          style={{
            animationDelay: `${animationDelay}s`
          }}
        >
          {showDateDivider && (
            <div 
              className="flex justify-center my-4 sticky top-2 z-10"
              style={{
                animation: 'fadeIn 0.3s ease-out forwards',
                opacity: 0
              }}
            >
              <span className="bg-[#f0f2f5] dark:bg-[#202c33] text-[#54656f] dark:text-[#8696a0] text-xs py-1.5 px-3 rounded-lg shadow-sm font-medium uppercase tracking-wide border border-gray-100 dark:border-gray-700/50">
                {currentDate === todayDateString ? 'Hoje' : currentDate}
              </span>
            </div>
          )}

          <MessageBubble 
            message={msg} 
            isMe={isMe}
            chatId={chat.id}
            chatPhoto={chat.profile_pic}
            showAvatar={showAvatar}
            sequencePosition={sequencePosition}
            onDelete={handleDelete}
            onSaveMacro={handleSaveMacro}
            onPreviewImage={handlePreviewImage}
          />
        </div>
      );
    });
  }, [allMessages, chat.id, chat.profile_pic, todayDateString, handleDelete, handleSaveMacro, handlePreviewImage]);

  return (
    <div 
      ref={containerRef}
      className="flex-1 overflow-y-auto p-4 md:px-[5%] space-y-0 bg-[#efeae2] dark:bg-[#0b141a] scrollbar-thin scrollbar-thumb-black/10 dark:scrollbar-thumb-white/10 will-change-scroll"
      style={{ 
        backgroundImage: 'url("/bg-chat-tile.png")', 
        backgroundRepeat: 'repeat', 
        backgroundSize: '400px',
        contain: 'layout style paint' // Otimização de renderização
      }} 
    >
      {renderedMessages}
      <div ref={bottomRef} className="h-4" />
    </div>
  );
}