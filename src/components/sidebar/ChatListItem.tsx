'use client';

import { memo, useRef, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  Pin, Trash2, Mail, ChevronDown, 
  CheckCheck, Check, Tag, UserCog, Archive,
  Camera, Mic, Sticker, FileText, Video, Ban, CheckCircle2,
  Bot, Sparkles // Ícones novos para a IA
} from 'lucide-react';
import { Chat } from '@/types';
import { TagData, formatTime } from '@/utils/sidebarUtils';
import { getAvatarColorHex, getAvatarTextColor } from '@/utils/colorUtils';

interface ChatListItemProps {
  chat: Chat;
  isSelected: boolean;
  isSelectionMode: boolean;
  isSelectedInMode: boolean;
  isMenuOpen: boolean;
  allTags: TagData[];
  onSelect: (chat: Chat) => void;
  onToggleSelection: (id: number) => void;
  onToggleMenu: (e: React.MouseEvent, id: number) => void;
  onAction: (e: React.MouseEvent, action: string, chat: Chat) => void;
}

const ChatListItem = memo(({ 
  chat, 
  isSelected, 
  isSelectionMode, 
  isSelectedInMode,
  isMenuOpen,
  allTags,
  onSelect,
  onToggleSelection,
  onToggleMenu,
  onAction
}: ChatListItemProps) => {
    
    const menuRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; openUpward: boolean } | null>(null);
    const [isExiting, setIsExiting] = useState(false);
    const exitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [avatarError, setAvatarError] = useState(false);

    // Identificador para o chat da IA
    const isAIChat = chat.phone === '00000000000';

    useEffect(() => {
      setAvatarError(false);
    }, [chat.id, chat.profile_pic]);

    useLayoutEffect(() => {
        if (!isMenuOpen || !triggerRef.current || typeof document === 'undefined') return;
        
        const updatePosition = () => {
            const trigger = triggerRef.current;
            if (!trigger) return;

            const rect = trigger.getBoundingClientRect();
            const menuHeight = 322;
            const padding = 8;
            const viewportH = window.innerHeight;

            const spaceBelow = viewportH - rect.bottom;
            const spaceAbove = rect.top;
            const openUpward = spaceBelow < menuHeight + padding && spaceAbove > spaceBelow;

            let top: number;
            if (openUpward) {
                top = Math.max(padding, rect.top - menuHeight - padding);
            } else {
                top = Math.min(viewportH - menuHeight - padding, rect.bottom + padding);
            }

            const menuWidth = 208;
            const left = Math.min(
                Math.max(rect.right - menuWidth, padding),
                window.innerWidth - menuWidth - padding
            );

            setMenuPosition({ top, left, openUpward });
        };

        updatePosition();
        window.addEventListener('scroll', updatePosition, true);
        window.addEventListener('resize', updatePosition);
        return () => {
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
        };
    }, [isMenuOpen]);

    useEffect(() => {
        if (isMenuOpen) {
            setIsExiting(false);
            if (exitTimeoutRef.current) {
                clearTimeout(exitTimeoutRef.current);
                exitTimeoutRef.current = null;
            }
        } else if (menuPosition) {
            setIsExiting(true);
            exitTimeoutRef.current = setTimeout(() => {
                setMenuPosition(null);
                setIsExiting(false);
                exitTimeoutRef.current = null;
            }, 260);
        }
        return () => {
            if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current);
        };
    }, [isMenuOpen]);

    const isUnread = (chat.unread_count || 0) > 0;
    
    const chatTags = (chat.tags || [])
      .map(tagId => allTags.find(t => t.id.toString() === tagId.toString()))
      .filter(Boolean) as TagData[];

    const renderMessagePreview = () => {
        const type = (chat.last_message_type || 'text') as string;
        const text = chat.last_message;
        const normalizedText = String(text || '')
          .toLowerCase()
          .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
          .replace(/\s+/g, ' ')
          .trim();
        const isAutoVideoPlaceholder = ['vídeo recebido', 'video recebido'].includes(normalizedText);
        const displayText = isAutoVideoPlaceholder ? '' : text;
        const singleLineText = String(displayText || '')
          .replace(/\s*\n+\s*/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        const sender = chat.last_message_sender || 'contact';
        
        const isMe = ['HUMAN_AGENT', 'AI_AGENT', 'me'].includes(sender) || 
                     (sender !== 'contact' && sender !== 'CUSTOMER' && sender !== chat.phone);
        
        let StatusIcon = null;
        if (isMe && type !== 'revoked') {
            if (chat.last_message_status === 'read') {
                StatusIcon = <CheckCheck size={16} className="text-[#53bdeb] shrink-0 mr-1" />;
            } else if (chat.last_message_status === 'delivered') {
                StatusIcon = <CheckCheck size={16} className="text-[#8696a0] shrink-0 mr-1" />;
            } else {
                StatusIcon = <Check size={16} className="text-[#8696a0] shrink-0 mr-1" />;
            }
        }

        let Content = null;
        const mediaIconClass = "shrink-0 mr-1 text-[#8696a0]";
        const textClass = `truncate ${isUnread ? 'text-[#111b21] dark:text-gray-100 font-medium' : 'text-[#667781] dark:text-[#8696a0]'}`;

        switch (type) {
            case 'audio':
                const seconds = chat.last_message_data?.duration || 0;
                const durationText = seconds > 0 
                    ? `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`
                    : 'Áudio';
                
                Content = (
                    <div className="flex items-center min-w-0">
                        <Mic size={16} className={`${mediaIconClass} flex-shrink-0`} />
                        <span className={`${textClass} truncate`}>{durationText}</span>
                    </div>
                );
                break;
            case 'image':
                Content = (
                    <div className="flex items-center min-w-0">
                        <Camera size={16} className={`${mediaIconClass} flex-shrink-0`} />
                        <span className={`${textClass} truncate`}>{singleLineText || 'Foto'}</span>
                    </div>
                );
                break;
            case 'video':
                Content = (
                    <div className="flex items-center min-w-0">
                        <Video size={16} className={`${mediaIconClass} flex-shrink-0`} />
                        {singleLineText ? <span className={`${textClass} truncate`}>{singleLineText}</span> : null}
                    </div>
                );
                break;
            case 'sticker':
                Content = (
                    <div className="flex items-center min-w-0">
                        <Sticker size={16} className={`${mediaIconClass} flex-shrink-0`} />
                        <span className={`${textClass} truncate`}>Figurinha</span>
                    </div>
                );
                break;
            case 'document':
                 Content = (
                    <div className="flex items-center min-w-0">
                        <FileText size={16} className={`${mediaIconClass} flex-shrink-0`} />
                        <span className={`${textClass} truncate`}>{singleLineText || 'Documento'}</span>
                    </div>
                );
                break;
            case 'revoked':
                Content = (
                    <div className="flex items-center text-[#8696a0] italic">
                        <Ban size={14} className="mr-1"/> 
                        <span className="text-[13px]">Mensagem apagada</span>
                    </div>
                );
                break;
            default:
                Content = (
                    <div 
                        className={`text-[14px] leading-[1.35] overflow-hidden min-w-0 whitespace-nowrap truncate ${isUnread ? 'text-[#111b21] dark:text-gray-100 font-medium' : 'text-[#667781] dark:text-[#8696a0]'}`}
                        style={{ overflow: 'hidden', textOverflow: 'ellipsis', wordBreak: 'break-word', lineHeight: '1.35' }}
                    >
                        <span>{singleLineText}</span>
                    </div>
                );
                break;
        }

        return (
            <div className="flex items-center overflow-hidden w-full min-h-[22px]">
                {StatusIcon && (
                    <div className="shrink-0 mr-1 flex-shrink-0">
                        {StatusIcon}
                    </div>
                )}
                <div className="flex-1 min-w-0 overflow-hidden">
                    {Content}
                </div>
            </div>
        );
    };

    const firstTagColor = chatTags.length > 0 && chatTags[0].color ? chatTags[0].color : null;

    return (
      <div 
        onClick={isSelectionMode && !isAIChat ? () => onToggleSelection(chat.id) : () => onSelect(chat)}
        className={`group relative flex items-stretch cursor-pointer transition-colors duration-150 ease-in-out border-b border-gray-100 dark:border-gray-800 min-h-[72px]
          ${isSelectionMode && isSelectedInMode 
            ? 'bg-primary/10' 
            : isSelected && !isSelectionMode
              ? 'bg-[#f0f2f5] dark:bg-[#202c33]' 
              : 'hover:bg-[#f5f6f6] dark:hover:bg-[#202c33] bg-white dark:bg-[#111b21]'}
        `}
      >
        {firstTagColor && !isSelectionMode && (
          <div 
            className="absolute inset-0 pointer-events-none transition-opacity duration-150 z-0"
            style={{ background: `linear-gradient(135deg, ${firstTagColor}26 0%, rgba(255,255,255,0) 100%)` }}
            aria-hidden
          />
        )}
        
        {/* COLUNA ESQUERDA */}
        <div className="flex items-center pl-3 pr-3 py-3 shrink-0">
          {isSelectionMode && (
            isAIChat ? (
              <div className="mr-2 w-5 h-5" /> // Spacer para manter alinhamento
            ) : (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onToggleSelection(chat.id); }}
                className={`mr-2 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                  isSelectedInMode ? 'bg-[#00a884] border-[#00a884] text-white' : 'bg-white dark:bg-[#111b21] border-gray-300 dark:border-gray-600 text-transparent'
                }`}
              >
                <Check size={13} />
              </button>
            )
          )}
          
          {isAIChat ? (
            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 shadow-sm border border-indigo-400/30">
              <Bot size={24} className="text-white" />
            </div>
          ) : (
            <div 
              className="w-12 h-12 rounded-full flex items-center justify-center overflow-hidden border border-gray-100 dark:border-gray-700"
              style={!chat.profile_pic || avatarError ? { backgroundColor: getAvatarColorHex(chat.id) } : {}}
            >
              {chat.profile_pic && !avatarError ? (
                <img src={chat.profile_pic} alt="Avatar" className="w-full h-full object-cover" onError={() => setAvatarError(true)} loading="lazy" />
              ) : (
                <span className="text-lg font-semibold select-none" style={{ color: getAvatarTextColor(chat.id) }}>
                  {(chat.contact_name || chat.phone || '?').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
          )}
        </div>

        {/* CONTEÚDO PRINCIPAL */}
        <div className="flex-1 min-w-0 flex flex-col justify-center py-3 pr-2 overflow-hidden">
            
            {/* Linha 1: Nome e Hora */}
            <div className="flex items-center gap-2 min-h-[20px] flex-shrink-0">
                <h3 className={`text-[15px] truncate leading-tight font-semibold flex-1 min-w-0 flex items-center gap-1.5 ${isUnread ? 'text-black dark:text-white' : 'text-[#111b21] dark:text-gray-200'}`}>
                    {isAIChat && <Sparkles size={14} className="text-indigo-500" />}
                    {chat.contact_name || chat.phone}
                </h3>
                <span className={`text-[11px] shrink-0 whitespace-nowrap ${isUnread ? 'text-[#25d366] font-medium' : 'text-[#667781] dark:text-[#8696a0]'}`}>
                    {formatTime(chat.last_interaction_at)}
                </span>
            </div>
            
            {/* Linha 2: Preview + Ícones */}
            <div className="flex items-center gap-2 min-h-[22px] flex-shrink-0">
                <div className="flex-1 min-w-0 overflow-hidden" style={{ minWidth: 0 }}>
                    {renderMessagePreview()}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    {chat.is_pinned && !isAIChat && (
                      <Pin size={14} className="text-[#8696a0] rotate-45" />
                    )}
                    {chat.is_ai_paused && isUnread && (
                      <span className="bg-orange-500 text-white text-[10px] font-bold h-[18px] min-w-[18px] px-1 rounded-full flex items-center justify-center animate-pulse">
                        {chat.unread_count}
                      </span>
                    )}
                    {!chat.is_ai_paused && isUnread && (
                      <span className="bg-[#25d366] text-[#111b21] text-[10px] font-bold h-[18px] min-w-[18px] px-1 rounded-full flex items-center justify-center">
                        {chat.unread_count}
                      </span>
                    )}
                    
                    {/* Botão de menu oculto para o chat da IA */}
                    {!isAIChat && (
                      <button 
                          ref={triggerRef}
                          onClick={(e) => onToggleMenu(e, chat.id)}
                          className="text-[#8696a0] p-1 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 transition-colors flex items-center justify-center w-[24px] h-[24px]"
                          style={{ opacity: isMenuOpen ? 1 : 0.3 }}
                      >
                          <ChevronDown size={16} />
                      </button>
                    )}
                </div>
            </div>

            {/* Linha 3: Tags */}
            {chatTags.length > 0 && !isAIChat && (
                <div className="flex flex-wrap gap-1 mt-1 min-h-[18px] max-h-[36px] overflow-hidden">
                    {chatTags.map((tag, idx) => (
                        <span key={idx} className="tag-bounce-in relative overflow-hidden rounded-[4px] inline-flex items-center" style={{ animationDelay: `${idx * 70}ms` }}>
                            <span className="tag-gradient-sweep absolute inset-0 rounded-[4px]" style={{ backgroundColor: tag.color ? `${tag.color}18` : 'rgba(0,0,0,0.05)', animationDelay: `${idx * 70}ms` }} aria-hidden />
                            <span className="relative z-10 text-[10px] px-1.5 py-0.5 font-medium" style={{ color: tag.color || '#667781' }}>{tag.name}</span>
                        </span>
                    ))}
                </div>
            )}
        </div>

        {/* MENU SUSPENSO */}
        {!isSelectionMode && !isAIChat && (isMenuOpen || isExiting) && menuPosition && typeof document !== 'undefined' && createPortal(
          <div 
            ref={menuRef}
            data-chat-menu
            className={`fixed w-52 bg-white dark:bg-[#2a2d36] rounded-lg shadow-lg py-2 z-[9999] border border-gray-100 dark:border-gray-700 transition-all ${isExiting ? (menuPosition.openUpward ? 'animate-chat-menu-out-upward' : 'animate-chat-menu-out') : (menuPosition.openUpward ? 'animate-chat-menu-in-upward' : 'animate-chat-menu-in')}`}
            style={{ top: menuPosition.top, left: menuPosition.left, transformOrigin: menuPosition.openUpward ? 'bottom right' : 'top right' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={(e) => { e.stopPropagation(); onAction(e, 'edit_contact', chat); }} className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5 text-[#3b4a54] dark:text-gray-200 text-[14.5px] flex items-center gap-3">
              <UserCog size={17} className="text-[#54656f] dark:text-gray-400" /> Editar Contato
            </button>
            <button onClick={(e) => { e.stopPropagation(); onAction(e, 'tags', chat); }} className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5 text-[#3b4a54] dark:text-gray-200 text-[14.5px] flex items-center gap-3">
              <Tag size={17} className="text-[#54656f] dark:text-gray-400" /> Editar Etiquetas
            </button>
            <button onClick={(e) => onAction(e, 'archive', chat)} className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5 text-[#3b4a54] dark:text-gray-200 text-[14.5px] flex items-center gap-3">
              <Archive size={17} className="text-[#54656f] dark:text-gray-400" /> {chat.is_archived ? 'Desarquivar' : 'Arquivar'}
            </button>
            <button onClick={(e) => onAction(e, 'pin', chat)} className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5 text-[#3b4a54] dark:text-gray-200 text-[14.5px] flex items-center gap-3">
              <Pin size={17} className="text-[#54656f] dark:text-gray-400" /> {chat.is_pinned ? 'Desafixar' : 'Fixar'}
            </button>
            <button onClick={(e) => onAction(e, 'unread', chat)} className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5 text-[#3b4a54] dark:text-gray-200 text-[14.5px] flex items-center gap-3">
              <Mail size={17} className="text-[#54656f] dark:text-gray-400" /> {(chat.unread_count || 0) > 0 ? 'Marcar como lida' : 'Marcar como não lida'}
            </button>
            <button onClick={(e) => onAction(e, 'select', chat)} className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5 text-[#3b4a54] dark:text-gray-200 text-[14.5px] flex items-center gap-3">
              <CheckCircle2 size={17} className="text-[#54656f] dark:text-gray-400" /> Selecionar
            </button>
            <div className="my-1 border-t border-gray-100 dark:border-gray-700"></div>
            <button onClick={(e) => onAction(e, 'delete', chat)} className="w-full text-left px-4 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/10 text-red-500 text-[14.5px] flex items-center gap-3">
              <Trash2 size={17} /> Apagar conversa
            </button>
          </div>,
          document.body
        )}
      </div>
    );
});

ChatListItem.displayName = 'ChatListItem';
export default ChatListItem;