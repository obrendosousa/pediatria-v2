/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element, react-hooks/set-state-in-effect */
import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Message } from '@/types';
import { Check, CheckCheck, Trash2, BookmarkPlus, ChevronDown, Copy, User, Reply, Pencil, Loader2, FileText, Download, CheckCircle2, Play, Smile, Plus, Forward, Bot, Mic, ImageIcon, Video, FileIcon } from 'lucide-react';
import AudioMessage from './AudioMessage';
import { getAvatarColorHex, getAvatarTextColor } from '@/utils/colorUtils';
import dynamic from 'next/dynamic';
import { Emoji, EmojiStyle, Theme } from 'emoji-picker-react';
const EmojiPicker = dynamic(() => import('emoji-picker-react').then(mod => mod.default), {
  ssr: false,
  loading: () => <div className="w-[300px] h-[350px] bg-[var(--chat-surface)] rounded-xl animate-pulse" />,
});
import FormattedMessage from '@/components/ui/FormattedMessage';
import ClaraMarkdownMessage from '@/components/chat/ClaraMarkdownMessage';
import PdfPreviewCard from '@/components/chat/PdfPreviewCard';

interface MessageBubbleProps {
  message: Message;
  isMe: boolean;
  chatId: number | string;
  chatPhoto?: string | null;
  showAvatar: boolean;
  sequencePosition: 'single' | 'first' | 'middle' | 'last';
  onDelete: (msg: Message, deleteForEveryone: boolean) => void;
  onSaveMacro: (macro: { title: string; type: 'text' | 'audio' | 'image' | 'video' | 'document'; content: string }) => void;
  onReply: (msg: Message) => void;
  onEdit: (msg: Message) => void;
  onForward?: (msg: Message) => void;
  onReact?: (msg: Message, emoji: string) => void;
  onPreviewImage: (url: string) => void;
  onPreviewVideo: (url: string) => void;
  onSaveSticker?: (url: string) => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (msg: Message) => void;
  onStartSelection?: (msg: Message) => void;
  animate?: boolean;
  isAIChat?: boolean;
  isGroupChat?: boolean;
}

function emojiToUnified(emoji: string): string {
  return [...emoji]
    .map((char) => char.codePointAt(0)?.toString(16))
    .filter(Boolean)
    .join('-');
}

const DEFAULT_QUICK_REACTIONS = ['\u{1F44D}', '\u{2764}\u{FE0F}', '\u{1F602}', '\u{1F64F}'];
const QUICK_REACTIONS_KEY = 'recentReactionEmojis';

function getQuickReactions(): string[] {
  if (typeof window === 'undefined') return DEFAULT_QUICK_REACTIONS;
  try {
    const stored = localStorage.getItem(QUICK_REACTIONS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length >= 4) return parsed.slice(0, 4);
    }
  } catch { /* ignore */ }
  return DEFAULT_QUICK_REACTIONS;
}

function saveRecentReaction(emoji: string) {
  const current = getQuickReactions();
  const filtered = current.filter((e) => e !== emoji);
  const updated = [emoji, ...filtered].slice(0, 4);
  try {
    localStorage.setItem(QUICK_REACTIONS_KEY, JSON.stringify(updated));
  } catch { /* ignore */ }
}

function formatDocSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Thresholds para escolha do aspect ratio
const RATIO_LANDSCAPE = 1.4;  // >= 1.4 → 16:9
const RATIO_SQUARE    = 0.85; // >= 0.85 → 1:1; abaixo → 3:4

type ImageDims = {
  maxW: string;
  aspect: string;
};

function getRatioDims(naturalW: number, naturalH: number): ImageDims {
  const r = naturalW / naturalH;
  if (r >= RATIO_LANDSCAPE) return { maxW: 'max-w-[300px] sm:max-w-[320px]', aspect: 'aspect-[16/9]' };
  if (r >= RATIO_SQUARE)    return { maxW: 'max-w-[240px] sm:max-w-[260px]', aspect: 'aspect-[1/1]' };
  return                           { maxW: 'max-w-[210px] sm:max-w-[230px]', aspect: 'aspect-[3/4]' };
}

// Componente de vídeo com aspect ratio adaptativo (3:4 · 1:1 · 16:9)
function AdaptiveVideoMessage({
  src,
  caption,
  hasCaption,
  onClick,
}: {
  src: string;
  caption?: string;
  hasCaption: boolean;
  onClick: () => void;
}) {
  const [dims, setDims] = useState<ImageDims>({ maxW: 'max-w-[240px] sm:max-w-[260px]', aspect: 'aspect-[16/9]' });

  const handleMeta = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    setDims(getRatioDims(v.videoWidth, v.videoHeight));
  };

  return (
    <>
      <div
        className={`relative w-full ${dims.maxW} ${dims.aspect} cursor-pointer overflow-hidden bg-black transition-all duration-150 ${hasCaption ? 'rounded-t-[inherit]' : 'rounded-[inherit]'}`}
        onClick={onClick}
      >
        <video
          src={src}
          preload="metadata"
          muted
          playsInline
          className="w-full h-full object-cover"
          onLoadedMetadata={handleMeta}
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/25">
          <div className="h-11 w-11 rounded-full bg-black/55 text-white flex items-center justify-center">
            <Play size={20} className="ml-0.5" />
          </div>
        </div>
      </div>
      {hasCaption && caption && (
        <div className={`${dims.maxW} px-[9px] pt-1.5 pb-[22px]`}>
          <FormattedMessage text={caption} />
        </div>
      )}
    </>
  );
}

// Componente de imagem com aspect ratio adaptativo (3:4 · 1:1 · 16:9)
function AdaptiveImageMessage({
  src,
  caption,
  hasCaption,
  onClick,
}: {
  src: string;
  caption?: string;
  hasCaption: boolean;
  onClick: () => void;
}) {
  const [dims, setDims] = useState<ImageDims>({ maxW: 'max-w-[210px] sm:max-w-[230px]', aspect: 'aspect-[3/4]' });

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setDims(getRatioDims(img.naturalWidth, img.naturalHeight));
  };

  return (
    <>
      <div
        className={`relative w-full ${dims.maxW} ${dims.aspect} cursor-pointer overflow-hidden bg-black/5 transition-all duration-150 ${hasCaption ? 'rounded-t-lg' : 'rounded-lg'}`}
        onClick={onClick}
      >
        <img
          src={src}
          alt="Mídia"
          loading="lazy"
          onLoad={handleLoad}
          className="w-full h-full object-cover"
        />
      </div>
      {hasCaption && caption && (
        <div className={`${dims.maxW} px-[9px] pt-1.5 pb-[22px]`}>
          <FormattedMessage text={caption} />
        </div>
      )}
    </>
  );
}

function MessageBubble({
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
  onForward,
  onReact,
  onPreviewImage,
  onPreviewVideo,
  onSaveSticker,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
  onStartSelection,
  animate = false,
  isAIChat = false,
  isGroupChat = false,
}: MessageBubbleProps) {
  const toMacroPayload = useCallback(() => {
    const msgType = String(message.message_type || 'text').toLowerCase();
    const supportedMediaType = msgType === 'audio' || msgType === 'voice' || msgType === 'image' || msgType === 'video' || msgType === 'document';

    if (supportedMediaType) {
      return {
        title: '',
        type: (msgType === 'voice' ? 'audio' : msgType) as 'audio' | 'image' | 'video' | 'document',
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
    const handleScroll = (e: Event) => {
      const reactionEl = document.querySelector('[data-reaction-popup]');
      if (reactionEl?.contains(e.target as Node)) return;
      setShowMenu(false);
      setShowReactionPopup(false);
      setShowEmojiPicker(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);

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
    saveRecentReaction(emoji);
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
  const isContactMessage = message.message_type === 'contact';

  // Legenda real da imagem (texto que não é placeholder de sistema)
  const imageCaptionText = (() => {
    if (!isImageMessage) return '';
    const rawText = (message.message_text || '').trim();
    const normalized = rawText.toLowerCase()
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').replace(/\s+/g, ' ').trim();
    const placeholders = ['imagem recebida', 'midia', 'mídia', 'foto', '[midia]', '[mídia]', 'image', 'imagem'];
    return (normalized.length > 0 && !placeholders.includes(normalized)) ? rawText : '';
  })();

  // Legenda real do vídeo
  const videoCaptionText = (() => {
    if (!isVideoMessage) return '';
    const rawText = (message.message_text || '').trim();
    const normalized = rawText.toLowerCase()
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').replace(/\s+/g, ' ').trim();
    const placeholders = ['vídeo recebido', 'video recebido', 'vídeo', 'video', 'mídia', '[mídia]', 'media'];
    return (normalized.length > 0 && !placeholders.includes(normalized)) ? rawText : '';
  })();

  // Legenda real do documento (ignora o próprio nome do arquivo)
  const documentCaptionText = (() => {
    if (message.message_type !== 'document') return '';
    const toolData = (message.tool_data && typeof message.tool_data === 'object' ? message.tool_data : {}) as any;
    const fileName = String(toolData.file_name || message.message_text || '');
    const rawText = (message.message_text || '').trim();
    if (!rawText || rawText === fileName) return '';
    return rawText;
  })();

  // Imagem/vídeo COM legenda real muda o comportamento do balão
  const isMediaWithCaption = (isImageMessage && !!imageCaptionText) || (isVideoMessage && !!videoCaptionText);
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

  const isOnlyEmojis = (text: string) => {
    if (!text) return false;
    const cleanText = text.trim();
    const emojiRegex = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)+$/u;
    return emojiRegex.test(cleanText) && [...cleanText].length <= 6;
  };

  const renderTextContent = (text: string) => {
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

    const isPlanModeCard = /📋.*Plano gerado/i.test(text) && isAIChat && !isMe;

    if (isPlanModeCard) {
      // Remove o marcador "📋 **Plano gerado.**..." do texto — o botão substitui
      const planContent = text
        .replace(/📋\s*\*{0,2}Plano gerado\.\*{0,2}[^\n]*/giu, '')
        .replace(/📋\s*\*{0,2}Plano de Pesquisa\*{0,2}/giu, '')
        .replace(/---\s*\n?\*Para executar[^\n]*/giu, '')
        .trim();
      return (
        <div className="pt-1">
          <ClaraMarkdownMessage text={planContent} />
          <div className="mt-4 pt-3 border-t border-white/10">
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('clara:execute_plan', { detail: planContent }));
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <Play size={16} fill="currentColor" />
              Executar plano
            </button>
          </div>
        </div>
      );
    }

    // Mensagens da Clara renderizam Markdown completo (títulos, tabelas, listas, código)
    if (isAIChat && !isMe) {
      return (
        <div className="pt-1">
          <ClaraMarkdownMessage text={text} />
        </div>
      );
    }

    return (
      <div className="pt-1">
        <FormattedMessage text={text} />
      </div>
    );
  };

  const bgClass = isSticker
    ? 'bg-transparent shadow-none'
    : (isImageMessage && !imageCaptionText)
      ? 'bg-transparent shadow-none'
      : (isVideoMessage && !videoCaptionText)
        ? 'bg-transparent shadow-none'
        : isMe
          ? 'bg-[var(--chat-bubble-sent)] dark:bg-[var(--chat-bubble-sent-dark)]'
          : 'bg-white dark:bg-[#202c33]';

  // Mídia (imagem, vídeo, documento) sempre fica com os 4 cantos arredondados
  const isAnyMediaMsg = isImageMessage || isVideoMessage || message.message_type === 'document';

  let roundedClass = 'rounded-lg';
  if (!isSticker && !isRevoked && !isAnyMediaMsg) {
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

  const bgClassRevoked = isRevoked ? 'bg-[#e7e7e7] dark:bg-[#2a3942]' : '';
  const finalBgClass = isRevoked ? bgClassRevoked : bgClass;

  const renderContent = () => {
    if (isRevoked) {
      return (
        <span className="text-[#667781] dark:text-[#9aa6ad] text-[14px] line-through decoration-[1.5px]">
          Esta mensagem foi apagada
        </span>
      );
    }

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

    if (message.message_type === 'image' && message.media_url) {
      return (
        <AdaptiveImageMessage
          src={message.media_url}
          caption={imageCaptionText || undefined}
          hasCaption={!!imageCaptionText}
          onClick={() => onPreviewImage(message.media_url!)}
        />
      );
    }

    if ((message.message_type === 'audio' || message.message_type === 'voice') && message.media_url) {
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

    if (message.message_type === 'video' && message.media_url) {
      return (
        <AdaptiveVideoMessage
          src={message.media_url}
          caption={videoCaptionText || undefined}
          hasCaption={!!videoCaptionText}
          onClick={() => onPreviewVideo(message.media_url!)}
        />
      );
    }

    if (message.message_type === 'document' && message.media_url) {
      const toolData = (message.tool_data && typeof message.tool_data === 'object' ? message.tool_data : {}) as any;
      const fileName = String(toolData.file_name || message.message_text || 'Documento');
      const mime = String(toolData.mime_type || '');
      const fileSize = toolData.file_size ? formatDocSize(toolData.file_size) : null;
      const isPdf = mime.includes('pdf')
        || fileName.toLowerCase().endsWith('.pdf')
        || (message.media_url || '').toLowerCase().endsWith('.pdf')
        || (message.message_text || '').toLowerCase().endsWith('.pdf');
      const isSpreadsheet = mime.includes('spreadsheet') || mime.includes('excel') || /\.(xlsx?|csv)$/i.test(fileName);
      const isWord = mime.includes('wordprocessing') || mime.includes('msword') || /\.(docx?)$/i.test(fileName);

      // PDF: renderiza preview da primeira página com botões Visualizar/Baixar
      if (isPdf) {
        return (
          <div className="pt-1">
            <PdfPreviewCard url={message.media_url} fileName={fileName} fileSize={fileSize} />
            {documentCaptionText && (
              <div className="pt-1.5">
                <FormattedMessage text={documentCaptionText} />
              </div>
            )}
          </div>
        );
      }

      // Outros documentos: layout original com ícone
      const docStyle = isSpreadsheet
        ? { bg: 'bg-emerald-500', lightBg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-500', label: 'Planilha' }
        : isWord
          ? { bg: 'bg-blue-500', lightBg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-500', label: 'Word' }
          : { bg: 'bg-gray-500', lightBg: 'bg-gray-50 dark:bg-[#1c1c21]', text: 'text-gray-500', label: 'Documento' };

      return (
        <div className="pt-1 w-[240px] sm:w-[260px]">
          <a
            href={message.media_url}
            target="_blank"
            rel="noreferrer"
            className="block rounded-lg overflow-hidden border border-black/10 dark:border-white/10 hover:opacity-90 transition-opacity"
          >
            {/* Área de thumbnail — ícone centralizado estilo WhatsApp */}
            <div className={`w-full h-[110px] ${docStyle.bg} flex items-center justify-center relative`}>
              {/* Ícone de folha dobrada */}
              <div className="relative">
                <div className="w-16 h-20 bg-white/20 rounded-md flex items-end justify-center pb-2 shadow-md">
                  {/* Dobra da folha */}
                  <div className="absolute top-0 right-0 w-5 h-5 bg-white/30 rounded-bl-md" />
                  <FileText size={28} className="text-white" />
                </div>
              </div>
              {/* Badge do tipo */}
              <div className="absolute bottom-2 right-2 text-white/80 text-[10px] font-bold uppercase tracking-wider">
                {docStyle.label}
              </div>
            </div>

            {/* Rodapé com nome e tamanho */}
            <div className="flex items-center gap-2.5 px-3 py-2 bg-white/60 dark:bg-[#08080b]">
              <div className={`w-8 h-8 rounded-full ${docStyle.lightBg} flex items-center justify-center shrink-0`}>
                <FileText size={15} className={docStyle.text} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold truncate text-gray-800 dark:text-[#fafafa] leading-tight">
                  {fileName}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-[#a1a1aa] mt-0.5">
                  {docStyle.label}{fileSize ? ` \u2022 ${fileSize}` : ''} \u2022 Toque para abrir
                </p>
              </div>
              <Download size={14} className="text-gray-400 shrink-0" />
            </div>
          </a>
          {/* Legenda do documento abaixo do card */}
          {documentCaptionText && (
            <div className="pt-1.5">
              <FormattedMessage text={documentCaptionText} />
            </div>
          )}
        </div>
      );
    }

    // Cartão de contato (vCard)
    if (isContactMessage) {
      const toolData = (message.tool_data && typeof message.tool_data === 'object' ? message.tool_data : {}) as Record<string, unknown>;
      const singleContact = toolData.contact as { displayName?: string; vcard?: string } | undefined;
      const multipleContacts = toolData.contacts as Array<{ displayName?: string; vcard?: string }> | undefined;
      const contactsList = multipleContacts || (singleContact ? [singleContact] : []);

      // Parser simples de vCard para extrair telefone
      const parseVcardPhone = (vcard?: string): string => {
        if (!vcard) return '';
        const telMatch = vcard.match(/TEL[^:]*:([^\n\r]+)/i);
        return telMatch ? telMatch[1].trim() : '';
      };

      if (contactsList.length > 0) {
        return (
          <div className="pt-1 w-[240px] sm:w-[260px] space-y-1.5">
            {contactsList.map((c, idx) => {
              const phone = parseVcardPhone(c.vcard);
              return (
                <div
                  key={idx}
                  className="rounded-lg overflow-hidden border border-black/8 dark:border-white/8"
                >
                  <div className="flex items-center gap-3 px-3 py-2.5 bg-white/40 dark:bg-[#0a0a0d]">
                    <div className="w-10 h-10 rounded-full bg-[var(--accent)] flex items-center justify-center shrink-0">
                      <User size={18} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold truncate text-gray-800 dark:text-[#fafafa] leading-tight">
                        {c.displayName || 'Contato'}
                      </p>
                      {phone && (
                        <p className="text-[11px] text-gray-500 dark:text-[#a1a1aa] mt-0.5 truncate">
                          {phone}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      }
      // Fallback: sem dados de vCard, renderiza como texto
      return renderTextContent(message.message_text || '📇 Contato');
    }

    // Fallbacks para mídia sem media_url (mensagens ingeridas antes do fix ou falha de upload)
    if (message.message_type === 'audio' || message.message_type === 'voice') {
      return (
        <div className="pt-2 pb-1 w-[280px] min-w-[240px] max-w-full flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center shrink-0">
            <Mic size={18} className="text-white" />
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <div className="h-[6px] rounded-full bg-gray-300 dark:bg-gray-600 w-full" />
            <span className="text-[11px] text-gray-400 dark:text-[#71717a]">Áudio indisponível</span>
          </div>
        </div>
      );
    }

    if (isSticker) {
      return (
        <div className="w-32 h-32 flex items-center justify-center text-5xl opacity-60">
          💟
        </div>
      );
    }

    if (message.message_type === 'image') {
      return (
        <div className="w-[240px] sm:w-[260px] aspect-[4/3] rounded-[inherit] bg-gray-200 dark:bg-[#2d2d36] flex flex-col items-center justify-center gap-2">
          <ImageIcon size={32} className="text-gray-400 dark:text-[#71717a]" />
          <span className="text-[11px] text-gray-400 dark:text-[#71717a]">Imagem indisponível</span>
        </div>
      );
    }

    if (message.message_type === 'video') {
      return (
        <div className="w-[240px] sm:w-[260px] aspect-[16/9] rounded-[inherit] bg-gray-800 flex flex-col items-center justify-center gap-2">
          <Video size={32} className="text-gray-500" />
          <span className="text-[11px] text-gray-500">Vídeo indisponível</span>
        </div>
      );
    }

    if (message.message_type === 'document') {
      return (
        <div className="pt-1 w-[240px] sm:w-[260px]">
          <div className="rounded-lg overflow-hidden border border-black/10 dark:border-white/10">
            <div className="w-full h-[80px] bg-gray-500 flex items-center justify-center">
              <FileIcon size={28} className="text-white/70" />
            </div>
            <div className="flex items-center gap-2.5 px-3 py-2 bg-white/60 dark:bg-[#08080b]">
              <FileText size={15} className="text-gray-400 shrink-0" />
              <span className="text-[12px] text-gray-500 dark:text-[#a1a1aa] truncate">
                Documento indisponível
              </span>
            </div>
          </div>
        </div>
      );
    }

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
            isAIChat ? (
              <div className="w-[30px] h-[30px] rounded-full flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 shadow-sm border border-indigo-400/30">
                <Bot size={16} className="text-white" />
              </div>
            ) : (
              <div
                className="w-[30px] h-[30px] rounded-full overflow-hidden border border-gray-100 dark:border-[#3d3d48] flex items-center justify-center"
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
            )
          ) : (
            <div className="w-[30px]" />
          )}
        </div>
      )}

      {/* BALÃO: min-w garante espaço para horário mesmo em mensagens de 1–2 caracteres */}
      <div
        className={`relative max-w-[90%] sm:max-w-[85%] md:max-w-[65%] w-fit ${(!isSticker && !isRevoked && !isAnyMediaMsg) ? 'min-w-[80px]' : 'min-w-0'} shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] ${finalBgClass} ${roundedClass} ${isSticker || (isAnyMediaMsg && !isMediaWithCaption && message.message_type !== 'document') ? 'p-0 overflow-hidden' : isMediaWithCaption ? 'p-0 overflow-hidden' : isRevoked ? 'px-3 py-2 pb-[20px]' : 'px-[9px] pb-[22px]'} flex flex-col overflow-visible ${isSelectionMode && isSelected ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}
      >
        {/* Nome do participante em mensagens de grupo */}
        {isGroupChat && !isMe && (message.participant_name || message.participant_phone) && (
          <p
            className="text-[12px] font-semibold px-1 pt-1 pb-0 truncate"
            style={{ color: getAvatarColorHex(message.participant_phone || '') }}
          >
            {message.participant_name || message.participant_phone}
          </p>
        )}

        {/* Nome de quem enviou (atendente) em mensagens enviadas */}
        {isMe && message.tool_data?.sent_by_name && (
          <p className="text-[11px] font-semibold px-1 pt-1 pb-0 truncate text-[var(--chat-accent)] opacity-70">
            {message.tool_data.sent_by_name}
          </p>
        )}

        {/* Conteúdo */}
        <div className="min-w-0 overflow-hidden break-words">
          {message.tool_data?.forwarded === true && !isMe && (
            <p className="text-[11px] text-gray-500 dark:text-[#a1a1aa] mb-1 flex items-center gap-1">
              <Forward size={12} /> Encaminhada
            </p>
          )}
          {hasReplyPreview && (
            <div className="mb-1.5 rounded-md bg-black/5 dark:bg-white/5 px-2 py-1 border-l-[3px] border-[var(--chat-accent)]">
              <p className="text-[11px] font-semibold text-[var(--chat-accent)] truncate">
                {replyData?.sender === 'HUMAN_AGENT' || replyData?.sender === 'me' || replyData?.sender === 'AI_AGENT'
                  ? 'Você'
                  : (replyData?.sender === 'CUSTOMER' || replyData?.sender === 'contact') ? (replyData?.sender_name || 'Contato') : replyData?.sender || 'Contato'}
              </p>
              <p className="text-[12px] text-gray-600 dark:text-[#d4d4d8] truncate">
                {replyData?.message_type === 'audio' || replyData?.message_type === 'voice'
                  ? '\u{1F3B5} Áudio'
                  : replyData?.message_type === 'image'
                    ? '\u{1F4F7} Foto'
                    : replyData?.message_type === 'video'
                      ? '\u{1F3AC} Vídeo'
                      : replyData?.message_type === 'sticker'
                        ? '\u{1F49F} Figurinha'
                        : replyData?.message_type === 'document'
                          ? '\u{1F4C4} Documento'
                          : replyData?.message_type === 'contact'
                            ? '\u{1F4C7} Contato'
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
                  className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-[2px] text-[11px] ${reaction.mine
                    ? 'border-[var(--chat-accent)]/40 bg-[var(--chat-accent)]/10 text-[var(--chat-accent)] dark:text-[var(--chat-accent)]'
                    : 'border-black/10 bg-black/5 text-[#3b4a54] dark:text-[#c7d1d8]'
                    }`}
                >
                  <Emoji unified={emojiToUnified(reaction.emoji)} emojiStyle={EmojiStyle.APPLE} size={14} />
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

        {/* Botão de Reagir - aparece no hover */}
        {!isRevoked && !isSelectionMode && (
          <button
            ref={reactionButtonRef}
            onClick={() => {
              setShowMenu(false);
              setShowReactionPopup(!showReactionPopup);
              setShowEmojiPicker(false);
            }}
            className={`absolute top-0 ${isMe ? '-left-8' : '-right-8'} p-1.5 rounded-full bg-white/95 dark:bg-[var(--chat-surface)] border border-gray-200 dark:border-white/5 opacity-0 group-hover:opacity-100 transition-all duration-150 z-20 shadow-sm cursor-pointer hover:bg-[var(--chat-accent)]/10`}
            title="Reagir"
            aria-label="Reagir"
          >
            <Smile size={14} className="text-[#54656f] dark:text-[#aebac1]" />
          </button>
        )}

        {/* Botão de Menu - oculto para mensagens apagadas */}
        {!isRevoked && !isSelectionMode && (
          <button
            ref={buttonRef}
            onClick={() => {
              setShowReactionPopup(false);
              setShowEmojiPicker(false);
              setShowMenu(!showMenu);
            }}
            className={`absolute ${isSticker ? 'top-0 right-0 backdrop-blur-md bg-white/20 dark:bg-white/10 border-white/20 dark:border-white/10 shadow-lg' : '-top-3 right-1 bg-white/95 dark:bg-[var(--chat-surface)] border-gray-200/60 dark:border-white/5 shadow-sm'} p-1 rounded-full border opacity-0 group-hover:opacity-100 transition-all duration-200 z-20 cursor-pointer hover:bg-[var(--chat-accent)]/10 ${showMenu ? 'opacity-100' : ''}`}
            style={{
              transform: showMenu ? 'scale(1.1)' : 'scale(1)',
              transition: 'opacity 0.2s ease-out, transform 0.2s ease-out'
            }}
          >
            <ChevronDown size={16} className="text-[var(--chat-text-secondary)]" />
          </button>
        )}

        {/* Popup de reação rápida (pill) */}
        {showReactionPopup && !showEmojiPicker && createPortal(
          <div
            data-reaction-popup
            className="fixed z-[10000] bg-white dark:bg-[var(--chat-surface)] border border-gray-100 dark:border-[#3d3d48] shadow-[0_8px_32px_rgba(0,0,0,0.5)] rounded-full"
            style={{
              top: reactionPosition.top,
              left: reactionPosition.left,
              animation: 'reactionPopIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
              opacity: 0,
            }}
          >
            <div className="flex items-center gap-1 p-1.5">
              {getQuickReactions().map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handlePickReaction(emoji)}
                  className="h-9 w-9 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 cursor-pointer transition-all duration-150 hover:scale-125 active:scale-95 flex items-center justify-center"
                  title={`Reagir com ${emoji}`}
                >
                  <Emoji unified={emojiToUnified(emoji)} emojiStyle={EmojiStyle.APPLE} size={22} />
                </button>
              ))}
              <button
                onClick={() => setShowEmojiPicker(true)}
                className="h-9 w-9 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-[var(--chat-text-secondary)] flex items-center justify-center cursor-pointer transition-all duration-150 hover:scale-110"
                title="Mais emojis"
              >
                <Plus size={15} />
              </button>
            </div>
          </div>,
          document.body
        )}

        {/* Picker de emojis completo (separado) */}
        {showReactionPopup && showEmojiPicker && createPortal(
          <div
            data-reaction-popup
            className="fixed z-[10000] bg-white dark:bg-[var(--chat-surface)] border border-gray-100 dark:border-[#3d3d48] shadow-[0_8px_32px_rgba(0,0,0,0.5)] rounded-2xl overflow-hidden"
            style={{
              top: reactionPosition.top,
              left: reactionPosition.left,
              animation: 'emojiExpandIn 0.35s cubic-bezier(0.22, 1, 0.36, 1) forwards',
              opacity: 0,
            }}
          >
            <EmojiPicker
              onEmojiClick={(emojiData: any) => handlePickReaction(String(emojiData?.emoji || ''))}
              autoFocusSearch={true}
              theme={Theme.AUTO}
              emojiStyle={EmojiStyle.APPLE}
              searchDisabled={false}
              width={Math.min(320, typeof window !== 'undefined' ? window.innerWidth - 32 : 320)}
              height={380}
              previewConfig={{ showPreview: false }}
              lazyLoadEmojis={true}
            />
          </div>,
          document.body
        )}

        {/* Dropdown Menu - renderizado via Portal para evitar corte por overflow */}
        {showMenu && createPortal(
          <div
            data-message-menu
            className={`fixed bg-white dark:bg-[var(--chat-surface)] py-2 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-[9999] min-w-[160px] border border-gray-100 dark:border-white/5 ${menuPosition.openUp ? 'origin-bottom-right' : 'origin-top-right'}`}
            style={{
              top: menuPosition.top,
              left: menuPosition.left,
              animation: 'menuSlideIn 0.15s cubic-bezier(0.16, 1, 0.3, 1) forwards',
              opacity: 0,
              transform: menuPosition.openUp ? 'scale(0.92) translateY(3px)' : 'scale(0.92) translateY(-3px)',
              willChange: 'opacity, transform'
            } as React.CSSProperties}
          >
            {isSticker && message.media_url && onSaveSticker && (
              <button
                onClick={() => { onSaveSticker(message.media_url!); setShowMenu(false); }}
                className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/[0.03] text-[14px] text-[var(--chat-text-primary)] flex items-center gap-3 cursor-pointer transition-colors duration-150"
              >
                <BookmarkPlus size={16} /> Salvar Figurinha
              </button>
            )}
            {!isSticker && (
              <>
                <button
                  onClick={() => { navigator.clipboard.writeText(message.message_text || ''); setShowMenu(false); }}
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/[0.03] text-[14px] text-[var(--chat-text-primary)] flex items-center gap-3 cursor-pointer transition-colors duration-150"
                >
                  <Copy size={16} /> Copiar
                </button>
                <button
                  onClick={() => { onSaveMacro(toMacroPayload()); setShowMenu(false); }}
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/[0.03] text-[14px] text-[var(--chat-text-primary)] flex items-center gap-3 cursor-pointer transition-colors duration-150"
                >
                  <BookmarkPlus size={16} /> Ad. Respostas Rápidas
                </button>
              </>
            )}
            <button
              onClick={() => { onReply(message); setShowMenu(false); }}
              className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/[0.03] text-[14px] text-[var(--chat-text-primary)] flex items-center gap-3 cursor-pointer transition-colors duration-150"
            >
              <Reply size={16} /> Responder
            </button>
            {onForward && message.message_type !== 'revoked' && (
              <button
                onClick={() => { onForward(message); setShowMenu(false); }}
                className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/[0.03] text-[14px] text-[var(--chat-text-primary)] flex items-center gap-3 cursor-pointer transition-colors duration-150"
              >
                <Forward size={16} /> Encaminhar
              </button>
            )}
            <button
              onClick={() => { onStartSelection?.(message); setShowMenu(false); }}
              className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/[0.03] text-[14px] text-[var(--chat-text-primary)] flex items-center gap-3 cursor-pointer transition-colors duration-150"
            >
              <CheckCircle2 size={16} /> Selecionar mensagens
            </button>
            {canEdit && (
              <button
                onClick={() => { onEdit(message); setShowMenu(false); }}
                className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/[0.03] text-[14px] text-[var(--chat-text-primary)] flex items-center gap-3 cursor-pointer transition-colors duration-150"
              >
                <Pencil size={16} /> Editar
              </button>
            )}
            {isMe && (
              <button
                onClick={() => onDelete(message, true)}
                className="w-full text-left px-4 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/10 text-[14px] text-red-500 flex items-center gap-3 cursor-pointer transition-colors duration-150"
              >
                <Trash2 size={16} /> Apagar p/ todos
              </button>
            )}
            <button
              onClick={() => onDelete(message, false)}
              className="w-full text-left px-4 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/10 text-[14px] text-red-500 flex items-center gap-3 cursor-pointer transition-colors duration-150"
            >
              <Trash2 size={16} /> Apagar p/ mim
            </button>
          </div>,
          document.body
        )}
      </div>

      {isSelectionMode && !isMe && renderSelectionCheckbox('right')}
    </div>
  );
}

export default React.memo(MessageBubble, (prev, next) => {
  return (
    prev.message.id === next.message.id &&
    prev.message.message_text === next.message.message_text &&
    prev.message.message_type === next.message.message_type &&
    prev.message.status === next.message.status &&
    prev.isSelected === next.isSelected &&
    prev.isSelectionMode === next.isSelectionMode &&
    prev.sequencePosition === next.sequencePosition &&
    prev.showAvatar === next.showAvatar &&
    prev.chatPhoto === next.chatPhoto &&
    prev.isAIChat === next.isAIChat &&
     
    JSON.stringify((prev.message as any).reactions) === JSON.stringify((next.message as any).reactions)
  );
});
