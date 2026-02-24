'use client';

import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import { ChevronDown, Trash2, X } from 'lucide-react';
import { Message, Chat } from '@/types';
import MessageBubble from './MessageBubble';
import { useToast } from '@/contexts/ToastContext';

interface MessageListProps {
  messages: Message[];
  pendingMessages: any[];
  chat: Chat;
  onDelete: (msg: Message, deleteForEveryone: boolean) => Promise<void> | void;
  onSaveMacro: (macro: { title: string; type: 'text' | 'audio' | 'image' | 'video' | 'document'; content: string }) => void;
  onReply: (msg: Message) => void;
  onEdit: (msg: Message) => void;
  onForward?: (msg: Message) => void;
  onReact?: (msg: Message, emoji: string) => void;
  onPreviewImage: (url: string) => void;
  onPreviewVideo: (url: string) => void;
}

export default function MessageList({ 
  messages, 
  pendingMessages,
  chat, 
  onDelete,
  onSaveMacro,
  onReply,
  onEdit,
  onForward,
  onReact,
  onPreviewImage,
  onPreviewVideo
}: MessageListProps) {
  const { toast } = useToast();
  const pediatricWallpaper = useMemo(() => {
    const tile = `
      <svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 220 220">
        <g stroke="#7f96a1" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.13">
          <g transform="translate(14 18) rotate(-12)">
            <circle cx="14" cy="14" r="9"/>
            <circle cx="6" cy="6" r="3"/>
            <circle cx="22" cy="6" r="3"/>
            <circle cx="14" cy="16" r="2.2"/>
          </g>
          <g transform="translate(72 12) rotate(17)">
            <path d="M6 2v8a6 6 0 0 0 12 0V2"/>
            <path d="M12 16v6a6 6 0 0 0 6 6h2"/>
            <circle cx="24" cy="28" r="3.2"/>
          </g>
          <g transform="translate(134 24) rotate(-7)">
            <circle cx="12" cy="10" r="5"/>
            <circle cx="12" cy="10" r="1.5"/>
            <path d="M6 18a6 5 0 0 0 12 0"/>
          </g>
          <g transform="translate(176 10) rotate(11)">
            <rect x="7" y="4" width="10" height="4" rx="1"/>
            <rect x="5" y="8" width="14" height="20" rx="3"/>
            <path d="M8 13h8M8 18h8M8 23h8"/>
          </g>
          <g transform="translate(36 60) rotate(-18)">
            <path d="M8 18C4 14 2 11 2 8a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 3-2 6-6 10z"/>
          </g>
          <g transform="translate(94 58) rotate(22)">
            <circle cx="14" cy="14" r="9"/>
            <circle cx="6" cy="6" r="3"/>
            <circle cx="22" cy="6" r="3"/>
            <circle cx="14" cy="16" r="2.2"/>
          </g>
          <g transform="translate(150 72) rotate(-14)">
            <path d="M6 2v8a6 6 0 0 0 12 0V2"/>
            <path d="M12 16v6a6 6 0 0 0 6 6h2"/>
            <circle cx="24" cy="28" r="3.2"/>
          </g>
          <g transform="translate(10 102) rotate(9)">
            <rect x="7" y="4" width="10" height="4" rx="1"/>
            <rect x="5" y="8" width="14" height="20" rx="3"/>
            <path d="M8 13h8M8 18h8M8 23h8"/>
          </g>
          <g transform="translate(60 110) rotate(-23)">
            <circle cx="12" cy="10" r="5"/>
            <circle cx="12" cy="10" r="1.5"/>
            <path d="M6 18a6 5 0 0 0 12 0"/>
          </g>
          <g transform="translate(126 112) rotate(13)">
            <path d="M8 18C4 14 2 11 2 8a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 3-2 6-6 10z"/>
          </g>
          <g transform="translate(170 106) rotate(-8)">
            <circle cx="14" cy="14" r="9"/>
            <circle cx="6" cy="6" r="3"/>
            <circle cx="22" cy="6" r="3"/>
            <circle cx="14" cy="16" r="2.2"/>
          </g>
          <g transform="translate(22 152) rotate(-15)">
            <path d="M6 2v8a6 6 0 0 0 12 0V2"/>
            <path d="M12 16v6a6 6 0 0 0 6 6h2"/>
            <circle cx="24" cy="28" r="3.2"/>
          </g>
          <g transform="translate(92 166) rotate(6)">
            <rect x="7" y="4" width="10" height="4" rx="1"/>
            <rect x="5" y="8" width="14" height="20" rx="3"/>
            <path d="M8 13h8M8 18h8M8 23h8"/>
          </g>
          <g transform="translate(154 158) rotate(-27)">
            <circle cx="12" cy="10" r="5"/>
            <circle cx="12" cy="10" r="1.5"/>
            <path d="M6 18a6 5 0 0 0 12 0"/>
          </g>
          <g transform="translate(186 178) rotate(19)">
            <path d="M8 18C4 14 2 11 2 8a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 3-2 6-6 10z"/>
          </g>
        </g>
      </svg>
    `.trim();

    return `url("data:image/svg+xml;utf8,${encodeURIComponent(tile)}")`;
  }, []);

  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const lastMessageCountRef = useRef(0);
  const prevLengthRef = useRef(0);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Array<number | string>>([]);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  // Defesa extra: evita múltiplos "Esta mensagem foi apagada" idênticos.
  const dedupedMessages = useMemo(() => {
    const seenRevoked = new Set<string>();
    return messages.filter((m) => {
      if ((m as any).message_type !== 'revoked') return true;
      const key = `${m.sender}|${new Date(m.created_at).toISOString()}|${(m as any).wpp_id ?? 'no_wpp'}`;
      if (seenRevoked.has(key)) return false;
      seenRevoked.add(key);
      return true;
    });
  }, [messages]);

  // Memoizar todas as mensagens combinadas evitando duplicatas:
  // - Exclui pending cuja mensagem foi revogada OU que já tem correspondente real
  // - CRÍTICO: quando há revoked, o pending NUNCA deve aparecer (substituir no lugar, não duplicar)
  const allMessages = useMemo(() => {
    const revokedList = dedupedMessages.filter((m) => (m as any).message_type === 'revoked');
    const revokedTimes = revokedList.map((m) => new Date(m.created_at).getTime());
    const filteredPending = pendingMessages.filter((p) => {
      const pTime = new Date(p.created_at || 0).getTime();
      const pText = (p.message_text || '').trim();
      const pIsFromMe = p.sender === 'HUMAN_AGENT' || p.sender === 'me';
      // Exclui se há revoked no mesmo horário (janela 10s — cobre race conditions)
      if (revokedTimes.some((t) => Math.abs(t - pTime) < 10000)) return false;
      // Exclui se já tem real correspondente (mesmo texto/hora)
      const hasReal = dedupedMessages.some((m) => {
        const mTime = new Date(m.created_at).getTime();
        const mText = (m.message_text || '').trim();
        const mIsFromMe = m.sender === 'HUMAN_AGENT' || m.sender === 'me';
        return pIsFromMe && mIsFromMe && mText === pText && Math.abs(mTime - pTime) < 3000;
      });
      // Fallback: se existir qualquer real enviado por mim na mesma janela, não duplica pending
      const hasRealNearTime = dedupedMessages.some((m) => {
        const mTime = new Date(m.created_at).getTime();
        const mIsFromMe = m.sender === 'HUMAN_AGENT' || m.sender === 'me';
        return pIsFromMe && mIsFromMe && Math.abs(mTime - pTime) < 10000;
      });
      return !hasReal && !hasRealNearTime;
    });
    return [...dedupedMessages, ...filteredPending].sort((a, b) => {
      const t = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (t !== 0) return t;
      return String(a.id).localeCompare(String(b.id));
    });
  }, [dedupedMessages, pendingMessages]);

  const selectedMessages = useMemo(
    () => allMessages.filter((msg) => selectedMessageIds.includes(msg.id)),
    [allMessages, selectedMessageIds]
  );

  useEffect(() => {
    prevLengthRef.current = allMessages.length;
  }, [allMessages.length]);

  // Memoizar data de hoje para evitar recriação
  const todayDateString = useMemo(() => new Date().toLocaleDateString(), []);

  // Ao abrir um chat, sempre rolar até a última mensagem
  useEffect(() => {
    lastMessageCountRef.current = 0; // Força scroll quando mensagens carregarem
    shouldAutoScrollRef.current = true;
    setShowScrollToBottom(false);
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  }, [chat.id]);

  // Auto-scroll inteligente - apenas quando novas mensagens chegam
  useEffect(() => {
    const newMessageCount = allMessages.length;
    const hadNewMessages = newMessageCount > lastMessageCountRef.current;
    lastMessageCountRef.current = newMessageCount;

    // Só faz scroll se:
    // 1. Houve novas mensagens
    // 2. O usuário não está scrollado para cima (dentro de 200px do bottom)
    if (hadNewMessages && shouldAutoScrollRef.current && bottomRef.current) {
      requestAnimationFrame(() => {
        // Scroll instantâneo evita "dois pulos" (scroll + animação da mensagem)
        bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
      });
    }
  }, [allMessages.length]);

  // Detectar quando usuário scrolla para cima (mostrar seta + desabilitar auto-scroll)
  const updateScrollState = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const canScroll = scrollHeight > clientHeight;
    const scrolledUp = canScroll && distanceFromBottom > 100;
    shouldAutoScrollRef.current = distanceFromBottom < 200;
    setShowScrollToBottom(scrolledUp);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        const isBottomVisible = entry.isIntersecting;
        shouldAutoScrollRef.current = isBottomVisible;
        setShowScrollToBottom(!isBottomVisible);
      },
      {
        root: container,
        rootMargin: '0px 0px 100px 0px',
        threshold: 0,
      }
    );

    const bottom = bottomRef.current;
    if (bottom) observer.observe(bottom);

    container.addEventListener('scroll', updateScrollState, { passive: true });
    updateScrollState();

    return () => {
      observer.disconnect();
      container.removeEventListener('scroll', updateScrollState);
    };
  }, [chat.id, updateScrollState]);

  // Recalcular estado de scroll quando mensagens carregam (ex: ao trocar de chat)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      updateScrollState();
    });
    return () => cancelAnimationFrame(id);
  }, [allMessages.length, chat.id, updateScrollState]);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    shouldAutoScrollRef.current = true;
    setShowScrollToBottom(false);
  }, []);

  const isMyOutgoingMessage = useCallback((msg: Message) => {
    const sender = String(msg.sender || '');
    return sender === 'HUMAN_AGENT' || sender === 'AI_AGENT' || sender === 'me';
  }, []);

  const startSelectionMode = useCallback((msg: Message) => {
    setIsSelectionMode(true);
    setSelectedMessageIds([msg.id]);
  }, []);

  const toggleSelectedMessage = useCallback((msg: Message) => {
    setSelectedMessageIds((prev) =>
      prev.includes(msg.id) ? prev.filter((id) => id !== msg.id) : [...prev, msg.id]
    );
  }, []);

  const clearSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedMessageIds([]);
    setIsBatchDeleting(false);
  }, []);

  const handleBatchDeleteForMe = useCallback(async () => {
    if (!selectedMessages.length || isBatchDeleting) return;
    setIsBatchDeleting(true);
    try {
      for (const msg of selectedMessages) {
        await Promise.resolve(onDelete(msg, false));
      }
      clearSelectionMode();
    } finally {
      setIsBatchDeleting(false);
    }
  }, [selectedMessages, isBatchDeleting, onDelete, clearSelectionMode]);

  const handleBatchDeleteForEveryone = useCallback(async () => {
    if (!selectedMessages.length || isBatchDeleting) return;
    const eligible = selectedMessages.filter(
      (msg) => isMyOutgoingMessage(msg) && msg.message_type !== 'revoked'
    );
    const skipped = selectedMessages.length - eligible.length;

    if (!eligible.length) {
      toast.info('Nenhuma mensagem selecionada pode ser apagada para todos.');
      return;
    }

    setIsBatchDeleting(true);
    try {
      for (const msg of eligible) {
        await Promise.resolve(onDelete(msg, true));
      }
      if (skipped > 0) {
        toast.info(`${skipped} mensagem(ns) recebida(s) foram ignoradas em "apagar para todos".`);
      }
      clearSelectionMode();
    } finally {
      setIsBatchDeleting(false);
    }
  }, [selectedMessages, isBatchDeleting, onDelete, clearSelectionMode, isMyOutgoingMessage, toast]);

  // Memoizar callbacks para evitar re-renders desnecessários
  const handleDelete = useCallback((msg: Message, deleteForEveryone: boolean) => {
    onDelete(msg, deleteForEveryone);
  }, [onDelete]);

  const handleSaveMacro = useCallback((macro: { title: string; type: 'text' | 'audio' | 'image' | 'video' | 'document'; content: string }) => {
    onSaveMacro(macro);
  }, [onSaveMacro]);

  const handleReply = useCallback((msg: Message) => {
    onReply(msg);
  }, [onReply]);

  const handleEdit = useCallback((msg: Message) => {
    onEdit(msg);
  }, [onEdit]);

  const handleForward = useCallback((msg: Message) => {
    onForward?.(msg);
  }, [onForward]);

  const handlePreviewImage = useCallback((url: string) => {
    onPreviewImage(url);
  }, [onPreviewImage]);

  const handlePreviewVideo = useCallback((url: string) => {
    onPreviewVideo(url);
  }, [onPreviewVideo]);

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
      const isRevoked = msg.message_type === 'revoked';
      // Mensagens apagadas não agrupam (igual WhatsApp)
      const isPrevSameSender = prevMsg && !isRevoked && (prevMsg as any).message_type !== 'revoked' && (prevMsg.sender === 'me' || prevMsg.sender === 'HUMAN_AGENT') === isMe;
      const isNextSameSender = nextMsg && !isRevoked && (nextMsg as any).message_type !== 'revoked' && (nextMsg.sender === 'me' || nextMsg.sender === 'HUMAN_AGENT') === isMe;

      // Define a posição na sequência para ajustar bordas
      let sequencePosition: 'single' | 'first' | 'middle' | 'last' = 'single';
      if (!isRevoked && isPrevSameSender && isNextSameSender) sequencePosition = 'middle';
      else if (!isRevoked && !isPrevSameSender && isNextSameSender) sequencePosition = 'first';
      else if (!isRevoked && isPrevSameSender && !isNextSameSender) sequencePosition = 'last';

      const showAvatar = !isMe && (sequencePosition === 'last' || sequencePosition === 'single');

      // Anima só quando a contagem AUMENTA (nova msg). Não anima na troca otimista→real (mesma contagem)
      const isNewMessage = index === allMessages.length - 1 && allMessages.length > prevLengthRef.current && prevLengthRef.current > 0;

      return (
        <div key={msg.id || `msg-${index}`}>
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
            onReply={handleReply}
            onForward={handleForward}
            onEdit={handleEdit}
            onReact={onReact}
            onPreviewImage={handlePreviewImage}
            onPreviewVideo={handlePreviewVideo}
            isSelectionMode={isSelectionMode}
            isSelected={selectedMessageIds.includes(msg.id)}
            onToggleSelect={toggleSelectedMessage}
            onStartSelection={startSelectionMode}
            animate={isNewMessage}
          />
        </div>
      );
    });
  }, [
    allMessages,
    chat.id,
    chat.profile_pic,
    todayDateString,
    handleDelete,
    handleSaveMacro,
    handleReply,
    handleEdit,
    handlePreviewImage,
    isSelectionMode,
    selectedMessageIds,
    toggleSelectedMessage,
    startSelectionMode,
    handleForward,
  ]);

  return (
    <div className="relative flex-1 min-w-0 min-h-0 flex flex-col">
      {/* Área de scroll - conteúdo separado do botão para evitar clipping */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:px-[5%] space-y-0 bg-[#efeae2] dark:bg-[#0b141a] scrollbar-thin scrollbar-thumb-black/10 dark:scrollbar-thumb-white/10"
        style={{
          backgroundImage: pediatricWallpaper,
          backgroundRepeat: 'repeat',
          backgroundSize: '180px',
        }}
      >
        {isSelectionMode && (
          <div className="sticky top-2 z-20 mb-3 bg-white/90 dark:bg-[#1f2c34]/90 backdrop-blur border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 flex items-center justify-between gap-2 shadow-sm pointer-events-none">
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-200">
              {selectedMessageIds.length} selecionada(s)
            </div>
            <div className="flex items-center gap-2 pointer-events-auto">
              <button
                onClick={handleBatchDeleteForEveryone}
                disabled={!selectedMessageIds.length || isBatchDeleting}
                className="text-[11px] px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
              >
                Apagar p/ todos
              </button>
              <button
                onClick={handleBatchDeleteForMe}
                disabled={!selectedMessageIds.length || isBatchDeleting}
                className="text-[11px] px-2.5 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white disabled:opacity-50"
              >
                Apagar p/ mim
              </button>
              <button
                onClick={clearSelectionMode}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500"
                title="Cancelar seleção"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}
        {renderedMessages}
        <div ref={bottomRef} className="h-4" />
      </div>

      {/* Seta para rolar até a última mensagem - entrada/saída suave */}
      <button
        onClick={scrollToBottom}
        className={`absolute bottom-3 right-3 w-10 h-10 rounded-full bg-[#00a884]/50 hover:bg-[#00a884]/70 text-white shadow-lg flex items-center justify-center z-50 transition-all duration-300 ease-out hover:scale-105 active:scale-95 ${
          showScrollToBottom
            ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 scale-75 translate-y-4 pointer-events-none'
        }`}
        aria-label="Rolar até a última mensagem"
      >
        <ChevronDown size={22} strokeWidth={2.5} />
      </button>
    </div>
  );
}