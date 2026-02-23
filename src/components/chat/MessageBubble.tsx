import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Message } from '@/types';
import { Check, CheckCheck, Trash2, BookmarkPlus, ChevronDown, Copy, User, Reply, Pencil, Loader2, FileText, Download, CheckCircle2, Play, Smile, Plus } from 'lucide-react';
import AudioMessage from './AudioMessage';
import { getAvatarColorHex, getAvatarTextColor } from '@/utils/colorUtils';
import EmojiPicker, { Emoji, EmojiStyle, Theme } from 'emoji-picker-react';
import FormattedMessage from '@/components/ui/FormattedMessage'; // Importação do novo componente

interface MessageBubbleProps {
  message: Message;
  isMe: boolean;
  chatId: number | string; // ID do chat para determinar cor
  chatPhoto?: string | null;
  showAvatar: boolean;
  sequencePosition: 'single' | 'first' | 'middle' | 'last';
  onDelete: (msg: Message, deleteForEveryone: boolean) => void;
  onSaveMacro: (macro: { title: string; type: 'text' | 'audio' | 'image' | 'video' | 'document'; content: string }) => void;
  onReply: (msg: Message) => void;
  onEdit: (msg: Message) => void;
  onReact?: (msg: Message, emoji: string) => void;
  onPreviewImage: (url: string) => void;
  onPreviewVideo: (url: string) => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (msg: Message) => void;
  onStartSelection?: (msg: Message) => void;
  animate?: boolean;
}

export default function MessageBubble({ 
  message, 
  isMe, 
  chatId,
  chatPhoto,
  showAvatar,
  sequencePosition,
  onDelete,
  onSaveMacro,
  onReply,
  onEdit,
  onReact,
  onPreviewImage,
  onPreviewVideo,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
  onStartSelection,
  animate = false
}: MessageBubbleProps) {
  const toMacroPayload = useCallback(() => {
    const msgType = String(message.message_type || 'text').toLowerCase();
    const supportedMediaType = msgType === 'audio' || msgType === 'image' || msgType === 'video' || msgType === 'document';

    if (supportedMediaType) {
      return {
        title: '',
        type: msgType as 'audio' | 'image' | 'video' | 'document',
        content: message.media_url || '',
      };
    }

    return {
      title: '',
      type: 'text' as const,
      content: message.message_text || '',
    };
  }, [message.media_url, message.message_text, message.message_type]);

  const MENU_MIN_WIDTH = 160;
  const MENU_OFFSET = 4;
  const VIEWPORT_MARGIN = 8;
  const [showMenu, setShowMenu] = useState(false);
  const [showReactionPopup, setShowReactionPopup] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, openUp: false });
  const [reactionPosition, setReactionPosition] = useState({ top: 0, left: 0, openUp: false });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const reactionButtonRef = useRef<HTMLButtonElement>(null);
  const [imgError, setImgError] = useState(false);

  const recalculateMenuPosition = useCallback(() => {
    if (!buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const menu = document.querySelector('[data-message-menu]') as HTMLElement | null;
    const menuHeight = menu?.offsetHeight ?? 240;
    const menuWidth = Math.max(menu?.offsetWidth ?? MENU_MIN_WIDTH, MENU_MIN_WIDTH);

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < menuHeight + MENU_OFFSET && spaceAbove > spaceBelow;

    let top = openUp
      ? rect.top - menuHeight - MENU_OFFSET
      : rect.bottom + MENU_OFFSET;
    top = Math.max(VIEWPORT_MARGIN, Math.min(top, window.innerHeight - menuHeight - VIEWPORT_MARGIN));

    let left = rect.right - menuWidth;
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - menuWidth - VIEWPORT_MARGIN));

    setMenuPosition((prev) => {
      if (prev.top === top && prev.left === left && prev.openUp === openUp) {
        return prev;
      }
      return { top, left, openUp };
    });
  }, []);

  const recalculateReactionPosition = useCallback(() => {
    if (!reactionButtonRef.current) return;
    const rect = reactionButtonRef.current.getBoundingClientRect();
    const popup = document.querySelector('[data-reaction-popup]') as HTMLElement | null;
    const popupHeight = popup?.offsetHeight ?? (showEmojiPicker ? 360 : 48);
    const popupWidth = popup?.offsetWidth ?? (showEmojiPicker ? 320 : 260);
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < popupHeight + MENU_OFFSET && spaceAbove > spaceBelow;
    let top = openUp ? rect.top - popupHeight - MENU_OFFSET : rect.bottom + MENU_OFFSET;
    top = Math.max(VIEWPORT_MARGIN, Math.min(top, window.innerHeight - popupHeight - VIEWPORT_MARGIN));
    let left = isMe ? rect.right - popupWidth : rect.left;
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - popupWidth - VIEWPORT_MARGIN));
    setReactionPosition({ top, left, openUp });
  }, [isMe, showEmojiPicker, MENU_OFFSET, VIEWPORT_MARGIN]);

  // Recalcular posição do dropdown ao abrir (useLayoutEffect evita flash)
  useLayoutEffect(() => {
    if (!showMenu) return;

    recalculateMenuPosition();
    const raf = requestAnimationFrame(recalculateMenuPosition);
    window.addEventListener('resize', recalculateMenuPosition);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', recalculateMenuPosition);
    };
  }, [showMenu, recalculateMenuPosition]);

  useLayoutEffect(() => {
    if (!showReactionPopup) return;
    recalculateReactionPosition();
    const raf = requestAnimationFrame(recalculateReactionPosition);
    window.addEventListener('resize', recalculateReactionPosition);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', recalculateReactionPosition);
    };
  }, [showReactionPopup, showEmojiPicker, recalculateReactionPosition]);

  // Fechar menu ao clicar fora ou ao rolar (menu está em Portal)
  useEffect(() => {
    if (!showMenu && !showReactionPopup) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || reactionButtonRef.current?.contains(target)) return;
      const menu = document.querySelector('[data-message-menu]');
      if (menu?.contains(target)) return;
      const reaction = document.querySelector('[data-reaction-popup]');
      if (reaction?.contains(target)) return;
      setShowMenu(false);
      setShowReactionPopup(false);
      setShowEmojiPicker(false);
    };
    const handleScroll = () => {
      setShowMenu(false);
      setShowReactionPopup(false);
      setShowEmojiPicker(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    // Container do chat tem overflow-y-auto - scroll não propaga para window
    let el: HTMLElement | null = buttonRef.current;
    const scrollParents: HTMLElement[] = [];
    while (el) {
      const { overflowY } = getComputedStyle(el);
      if (overflowY === 'auto' || overflowY === 'scroll') scrollParents.push(el);
      el = el.parentElement;
    }
    scrollParents.forEach(p => p.addEventListener('scroll', handleScroll));
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
      scrollParents.forEach(p => p.removeEventListener('scroll', handleScroll));
    };
  }, [showMenu, showReactionPopup]);

  const handlePickReaction = (emoji: string) => {
    onReact?.(message, emoji);
    setShowReactionPopup(false);
    setShowEmojiPicker(false);
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isSticker = message.message_type === 'sticker';
  const isImageMessage = message.message_type === 'image' && !!message.media_url;
  const isVideoMessage = message.message_type === 'video' && !!message.media_url;
  const isRevoked = message.message_type === 'revoked';
  const canEdit = isMe && message.message_type === 'text' && !isRevoked;

  const replyData =
    message.tool_data && typeof message.tool_data === 'object'
      ? (message.tool_data as any).reply_to
      : null;

  const hasReplyPreview = Boolean(replyData?.wpp_id || replyData?.message_text);
  const messageReactions = Array.isArray(message.reactions) ? message.reactions : [];
  const groupedReactions = Array.from(
    messageReactions.reduce((acc, reactionItem) => {
      const emoji = String(reactionItem?.emoji || '').trim();
      if (!emoji) return acc;
      const current = acc.get(emoji) || { emoji, count: 0, mine: false };
      current.count += 1;
      current.mine = current.mine || Boolean(reactionItem?.from_me);
      acc.set(emoji, current);
      return acc;
    }, new Map<string, { emoji: string; count: number; mine: boolean }>())
      .values()
  );

  // Função para verificar se a mensagem contém APENAS emojis (para exibir grande)
  const isOnlyEmojis = (text: string) => {
    if (!text) return false;
    const cleanText = text.trim();
    const emojiRegex = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)+$/u;
    return emojiRegex.test(cleanText) && [...cleanText].length <= 6; 
  };

  // Renderizador de Texto
  const renderTextContent = (text: string) => {
      // 1. Se for APENAS emojis, mantém a lógica de "Big Emoji"
      if (isOnlyEmojis(text)) {
          const chars = [...text];
          return (
              <div className="flex flex-wrap gap-1 px-1 py-1">
                  {chars.map((char, i) => {
                      const codePoint = char.codePointAt(0)?.toString(16);
                      if (!codePoint) return <span key={i}>{char}</span>;
                      return (
                        <div key={i} className="animate-in zoom-in duration-300">
                             <Emoji 
                                unified={codePoint} 
                                emojiStyle={EmojiStyle.APPLE} 
                                size={32} 
                             />
                        </div>
                      );
                  })}
              </div>
          );
      }

      // 2. Se for texto normal ou misturado, usa o FormattedMessage
      return (
        <div className="pt-1">
           <FormattedMessage text={text} />
        </div>
      );
  };

  // Mensagens recebidas sempre brancas, enviadas verdes
  const bgClass = isSticker 
    ? 'bg-transparent shadow-none'
    : isImageMessage
      ? 'bg-transparent shadow-none'
    : isVideoMessage
      ? 'bg-transparent shadow-none'
    : isMe 
      ? 'bg-[#d9fdd3] dark:bg-[#005c4b]' 
      : 'bg-white dark:bg-[#202c33]';

  let roundedClass = 'rounded-lg';
  if (!isSticker && !isRevoked && !isVideoMessage && !isImageMessage) {
    if (isMe) {
      if (sequencePosition === 'first') roundedClass = 'rounded-lg rounded-br-[2px]';
      if (sequencePosition === 'middle') roundedClass = 'rounded-lg rounded-br-[2px] rounded-tr-[2px]';
      if (sequencePosition === 'last') roundedClass = 'rounded-lg rounded-tr-[2px]';
    } else {
      if (sequencePosition === 'first') roundedClass = 'rounded-lg rounded-bl-[2px]';
      if (sequencePosition === 'middle') roundedClass = 'rounded-lg rounded-bl-[2px] rounded-tl-[2px]';
      if (sequencePosition === 'last') roundedClass = 'rounded-lg rounded-tl-[2px]';
    }
  }

  const marginClass = (sequencePosition === 'first' || sequencePosition === 'middle') && !isSticker && !isRevoked
    ? 'mb-[2px]' 
    : 'mb-3';

  const msgStatus = (message.status ?? (message as any).status) || 'sent';

  // Mensagens apagadas: balão discreto na mesma posição (igual WhatsApp)
  const bgClassRevoked = isRevoked ? 'bg-[#e7e7e7] dark:bg-[#2a3942]' : '';
  const finalBgClass = isRevoked ? bgClassRevoked : bgClass;

  const renderContent = () => {
    // 0. Mensagem apagada (igual WhatsApp - balão discreto no fluxo)
    if (isRevoked) {
      return (
        <span className="text-[#667781] dark:text-[#9aa6ad] text-[14px] line-through decoration-[1.5px]">
          Esta mensagem foi apagada
        </span>
      );
    }

    // 1. Sticker
    if (isSticker && message.media_url) {
        return (
            <div className="overflow-hidden hover:scale-[1.02] transition-transform duration-200">
                <img 
                    src={message.media_url} 
                    alt="Figurinha" 
                    className="w-32 h-32 object-contain drop-shadow-sm" 
                    loading="lazy" 
                />
            </div>
        );
    }

    // 2. Imagem
    if (message.message_type === 'image' && message.media_url) {
      const rawText = (message.message_text || '').trim();
      const normalizedText = rawText
        .toLowerCase()
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
      const placeholderTexts = ['imagem recebida', 'midia', 'mídia', 'foto', '[midia]', '[mídia]', 'image', 'imagem'];
      const hasRealCaption = normalizedText.length > 0 && !placeholderTexts.includes(normalizedText);
      return (
        <>
          <div
            className="relative w-full max-w-[240px] sm:max-w-[260px] aspect-[3/4] cursor-pointer overflow-hidden rounded-md bg-black/5"
            onClick={() => onPreviewImage(message.media_url!)}
          >
            <img 
              src={message.media_url} 
              alt="Mídia" 
              loading="lazy"
              className="w-full h-full object-cover" 
            />
          </div>
          {hasRealCaption && (
            <div className="pt-1">
              {renderTextContent(message.message_text!)}
            </div>
          )}
        </>
      );
    }
    
    // 3. Áudio - dimensões fixas para evitar oscilação, proporção adequada
    if (message.message_type === 'audio' && message.media_url) {
       return (
         <div className="pt-2 pb-0 w-[280px] min-w-[240px] max-w-full">
            <AudioMessage 
              src={message.media_url as string} 
              isCustomer={!isMe} 
              simpleMode={true} 
            />
         </div>
       );
    }

    // 4. Vídeo
    if (message.message_type === 'video' && message.media_url) {
      const rawText = (message.message_text || '').trim();
      const normalizedText = rawText
        .toLowerCase()
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
      const placeholderTexts = ['vídeo recebido', 'video recebido', 'vídeo', 'video', 'mídia', '[mídia]', 'media'];
      const hasRealCaption = normalizedText.length > 0 && !placeholderTexts.includes(normalizedText);
      return (
        <>
          <div
            className="relative w-full max-w-[240px] sm:max-w-[260px] aspect-[3/4] cursor-pointer overflow-hidden rounded-md bg-black"
            onClick={() => onPreviewVideo(message.media_url!)}
          >
            <video
              src={message.media_url}
              preload="metadata"
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/25">
              <div className="h-11 w-11 rounded-full bg-black/55 text-white flex items-center justify-center">
                <Play size={20} className="ml-0.5" />
              </div>
            </div>
          </div>
          {hasRealCaption && (
            <div className="pt-1">{renderTextContent(message.message_text)}</div>
          )}
        </>
      );
    }

    // 5. Documento/PDF
    if (message.message_type === 'document' && message.media_url) {
      const toolData = (message.tool_data && typeof message.tool_data === 'object' ? message.tool_data : {}) as any;
      const fileName = String(toolData.file_name || message.message_text || 'Documento');
      const mime = String(toolData.mime_type || '');
      const isPdf = mime.includes('pdf') || fileName.toLowerCase().endsWith('.pdf');
      return (
        <div className="pt-1">
          <a
            href={message.media_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white/70 dark:bg-[#1e2028] hover:bg-white dark:hover:bg-[#24323a] transition-colors"
          >
            <div className="w-9 h-9 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-300 flex items-center justify-center">
              <FileText size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate text-gray-700 dark:text-gray-100">
                {fileName}
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-300">
                {isPdf ? 'PDF' : 'Documento'} - toque para abrir
              </p>
            </div>
            <Download size={16} className="text-gray-400" />
          </a>
        </div>
      );
    }

    // 6. Texto
    return renderTextContent(message.message_text || '');
  };

  const renderSelectionCheckbox = (side: 'left' | 'right') => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggleSelect?.(message);
      }}
      className={`relative w-6 h-6 ${side === 'left' ? 'mr-2' : 'ml-2'} mt-auto mb-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1f2c34] flex items-center justify-center shrink-0 z-10`}
      aria-label={isSelected ? 'Desmarcar mensagem' : 'Selecionar mensagem'}
    >
      {isSelected && <Check size={13} className="text-blue-500" />}
    </button>
  );

  return (
    <div 
      className={`group flex w-full min-w-0 ${isMe ? 'justify-end' : 'justify-start'} ${marginClass} select-none ${animate ? 'animate-message-fade-in' : ''} ${isSelectionMode ? 'cursor-pointer' : ''}`}
      onClick={isSelectionMode ? () => onToggleSelect?.(message) : undefined}
    >
      {isSelectionMode && isMe && renderSelectionCheckbox('left')}

      {/* AVATAR */}
      {!isMe && (
         <div className="w-[30px] mr-2 flex flex-col justify-end shrink-0">
            {showAvatar ? (
               <div 
                 className="w-[30px] h-[30px] rounded-full overflow-hidden border border-gray-100 dark:border-gray-700 flex items-center justify-center"
                 style={!chatPhoto ? { backgroundColor: getAvatarColorHex(chatId) } : {}}
               >
                  {chatPhoto && !imgError ? (
                    <img 
                      src={chatPhoto} 
                      className="w-full h-full object-cover" 
                      alt="Avatar"
                      onError={() => setImgError(true)}
                    />
                  ) : (
                    <User 
                      className="w-4 h-4 opacity-90" 
                      style={{ color: getAvatarTextColor(chatId) }}
                    />
                  )}
               </div>
            ) : (
               <div className="w-[30px]" />
            )}
         </div>
      )}

      {/* BALÃO: min-w garante espaço para horário mesmo em mensagens de 1–2 caracteres */}
      <div 
        className={`relative max-w-[90%] sm:max-w-[85%] md:max-w-[65%] w-fit ${!isSticker && !isRevoked && !isVideoMessage && !isImageMessage ? 'min-w-[80px] shadow-[0_1px_0.5px_rgba(0,0,0,0.13)]' : 'min-w-0'} ${finalBgClass} ${roundedClass} ${isSticker || isVideoMessage || isImageMessage ? 'p-0 overflow-hidden' : isRevoked ? 'px-3 py-2 pb-[20px]' : 'px-[9px] pb-[22px]'} flex flex-col overflow-visible ${isSelectionMode && isSelected ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}
      >
        
        {/* Conteúdo */}
        <div className="min-w-0 overflow-hidden break-words">
           {hasReplyPreview && (
             <div className="mb-1.5 rounded-md bg-black/5 dark:bg-white/5 px-2 py-1 border-l-[3px] border-green-500">
               <p className="text-[11px] font-semibold text-green-700 dark:text-green-400 truncate">
                 {replyData?.sender === 'HUMAN_AGENT' || replyData?.sender === 'me' ? 'Você' : replyData?.sender || 'Contato'}
               </p>
               <p className="text-[12px] text-gray-600 dark:text-gray-300 truncate">
                 {replyData?.message_type === 'audio'
                   ? '🎵 Áudio'
                   : replyData?.message_type === 'image'
                   ? '📷 Foto'
                   : replyData?.message_type === 'video'
                   ? '🎬 Vídeo'
                   : replyData?.message_text || 'Mensagem'}
               </p>
             </div>
           )}
           {renderContent()}
           {groupedReactions.length > 0 && (
             <div className="mt-1.5 flex flex-wrap items-center gap-1 pr-12">
               {groupedReactions.map((reaction) => (
                 <span
                   key={reaction.emoji}
                   className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-[2px] text-[11px] ${
                     reaction.mine
                       ? 'border-[#00a884]/40 bg-[#00a884]/10 text-[#007a63] dark:text-[#8fe3d5]'
                       : 'border-black/10 bg-black/5 text-[#3b4a54] dark:text-[#c7d1d8]'
                   }`}
                 >
                   <span>{reaction.emoji}</span>
                   <span>{reaction.count}</span>
                 </span>
               ))}
             </div>
           )}
        </div>

        {/* Metadados: Hora + Check — sempre visível graças ao min-w do balão */}
        <div className={`absolute bottom-[3px] right-[7px] flex items-center gap-[3px] select-none h-[15px] shrink-0 ${isSticker ? 'bg-black/30 rounded-full px-1.5 py-0.5 backdrop-blur-sm' : ''}`}>
           <span className={`text-[11px] tabular-nums leading-none ${isSticker ? 'text-white font-medium' : 'text-[rgba(17,27,33,0.6)] dark:text-[rgba(255,255,255,0.6)]'}`}>
             {formatTime(message.created_at)}
           </span>
           
           {isMe && !isSticker && !isRevoked && (
             <span className={
               msgStatus === 'uploading' || msgStatus === 'sending'
                 ? 'text-[#8696a0]'
                 :
               msgStatus === 'read' ? 'text-[#53bdeb]' :
               msgStatus === 'delivered' ? 'text-[#8696a0]' :
               'text-[rgba(17,27,33,0.4)] dark:text-[rgba(255,255,255,0.5)]'
             }>
               {msgStatus === 'uploading' || msgStatus === 'sending'
                 ? <Loader2 size={14} className="animate-spin" />
                 : msgStatus === 'read' || msgStatus === 'delivered'
                 ? <CheckCheck size={16} strokeWidth={1.5} />
                 : <Check size={16} strokeWidth={1.5} />}
             </span>
           )}
        </div>

        {/* Botão de Menu - oculto para mensagens apagadas */}
        {!isRevoked && !isSelectionMode && (
          <button
            ref={reactionButtonRef}
            onClick={() => {
              setShowMenu(false);
              setShowReactionPopup(!showReactionPopup);
              setShowEmojiPicker(false);
            }}
            className={`absolute top-0 ${isMe ? '-left-8' : '-right-8'} p-1.5 rounded-full bg-white/95 dark:bg-[#202c33] border border-gray-200 dark:border-gray-700 opacity-0 group-hover:opacity-100 transition-all duration-150 z-20 shadow-sm`}
            title="Reagir"
            aria-label="Reagir"
          >
            <Smile size={14} className="text-[#54656f] dark:text-[#aebac1]" />
          </button>
        )}

        {/* Botão de Menu - oculto para mensagens apagadas */}
        {!isSticker && !isRevoked && !isSelectionMode && !isVideoMessage && !isImageMessage && (
            <button 
              ref={buttonRef}
              onClick={() => {
                setShowReactionPopup(false);
                setShowEmojiPicker(false);
                setShowMenu(!showMenu);
              }}
              className={`absolute top-0 right-0 p-1 m-0.5 rounded-full bg-gradient-to-l from-[rgba(255,255,255,0.95)] via-[rgba(255,255,255,0.8)] to-transparent dark:from-[#202c33] opacity-0 group-hover:opacity-100 transition-all duration-150 z-20 ${showMenu ? 'opacity-100' : ''}`}
              style={{
                transform: showMenu ? 'scale(1.1)' : 'scale(1)',
                transition: 'opacity 0.15s ease-out, transform 0.15s ease-out'
              }}
            >
               <ChevronDown size={18} className="text-[#54656f] dark:text-[#aebac1] drop-shadow-sm"/>
            </button>
        )}

        {/* Popup de reação estilo WhatsApp */}
        {showReactionPopup && createPortal(
          <div
            data-reaction-popup
            className="fixed z-[10000] bg-white dark:bg-[#233138] border border-gray-100 dark:border-gray-700 shadow-[0_4px_12px_rgba(0,0,0,0.15)] rounded-full p-1.5"
            style={{
              top: reactionPosition.top,
              left: reactionPosition.left,
              borderRadius: showEmojiPicker ? 12 : 999,
            }}
          >
            {!showEmojiPicker ? (
              <div className="flex items-center gap-1">
                {['👍', '❤️', '😂', '😮', '🙏'].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handlePickReaction(emoji)}
                    className="h-8 w-8 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-lg"
                    title={`Reagir com ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
                <button
                  onClick={() => setShowEmojiPicker(true)}
                  className="h-8 w-8 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-[#54656f] dark:text-[#aebac1] flex items-center justify-center"
                  title="Mais emojis"
                >
                  <Plus size={14} />
                </button>
              </div>
            ) : (
              <EmojiPicker
                onEmojiClick={(emojiData: any) => handlePickReaction(String(emojiData?.emoji || ''))}
                autoFocusSearch={true}
                theme={Theme.AUTO}
                emojiStyle={EmojiStyle.APPLE}
                searchDisabled={false}
                width={320}
                height={360}
                previewConfig={{ showPreview: false }}
                lazyLoadEmojis={true}
              />
            )}
          </div>,
          document.body
        )}

        {/* Dropdown Menu - renderizado via Portal para evitar corte por overflow */}
        {showMenu && createPortal(
          <div 
            data-message-menu
            className={`fixed bg-white dark:bg-[#233138] py-2 rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.15)] z-[9999] min-w-[160px] border border-gray-100 dark:border-gray-700 ${menuPosition.openUp ? 'origin-bottom-right' : 'origin-top-right'}`}
            style={{
              top: menuPosition.top,
              left: menuPosition.left,
              animation: 'menuSlideIn 0.15s cubic-bezier(0.16, 1, 0.3, 1) forwards',
              opacity: 0,
              transform: menuPosition.openUp ? 'scale(0.92) translateY(3px)' : 'scale(0.92) translateY(-3px)',
              willChange: 'opacity, transform'
            } as React.CSSProperties}
          >
             <button 
                onClick={() => { navigator.clipboard.writeText(message.message_text || ''); setShowMenu(false); }}
                className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5 text-[14px] text-[#3b4a54] dark:text-gray-200 flex items-center gap-3"
             >
                <Copy size={16}/> Copiar
             </button>
             <button 
                onClick={() => { onSaveMacro(toMacroPayload()); setShowMenu(false); }}
                className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5 text-[14px] text-[#3b4a54] dark:text-gray-200 flex items-center gap-3"
             >
                <BookmarkPlus size={16}/> Ad. Respostas Rápidas
             </button>
             <button
                onClick={() => { onReply(message); setShowMenu(false); }}
                className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5 text-[14px] text-[#3b4a54] dark:text-gray-200 flex items-center gap-3"
             >
                <Reply size={16}/> Responder
             </button>
             <button
                onClick={() => { onStartSelection?.(message); setShowMenu(false); }}
                className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5 text-[14px] text-[#3b4a54] dark:text-gray-200 flex items-center gap-3"
             >
                <CheckCircle2 size={16}/> Selecionar mensagens
             </button>
             {canEdit && (
               <button
                  onClick={() => { onEdit(message); setShowMenu(false); }}
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5 text-[14px] text-[#3b4a54] dark:text-gray-200 flex items-center gap-3"
               >
                  <Pencil size={16}/> Editar
               </button>
             )}
             {isMe && (
               <button 
                  onClick={() => onDelete(message, true)}
                  className="w-full text-left px-4 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/10 text-[14px] text-red-500 flex items-center gap-3"
               >
                  <Trash2 size={16}/> Apagar p/ todos
               </button>
             )}
              <button 
                  onClick={() => onDelete(message, false)}
                  className="w-full text-left px-4 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/10 text-[14px] text-red-500 flex items-center gap-3"
               >
                  <Trash2 size={16}/> Apagar p/ mim
               </button>
          </div>,
          document.body
        )}
      </div>

      {isSelectionMode && !isMe && renderSelectionCheckbox('right')}
    </div>
  );
}