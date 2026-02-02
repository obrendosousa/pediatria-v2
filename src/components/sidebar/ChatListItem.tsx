'use client';

import { memo, useRef, useEffect } from 'react';
import { 
  Pin, Trash2, Mail, ChevronDown, User, 
  MessageSquareWarning, CheckCheck, Check, Tag, UserCog, Archive,
  Camera, Mic, Sticker, FileText, Video, Ban
} from 'lucide-react';
import { Chat } from '@/types';
import FormattedMessage from '@/components/ui/FormattedMessage';
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

    // Fecha o menu se clicar fora
    useEffect(() => {
        if (!isMenuOpen) return;
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
               // A lógica de fechar geralmente é gerida pelo pai
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isMenuOpen]);

    const isUnread = (chat.unread_count || 0) > 0;
    
    // Resolve tags
    const chatTags = (chat.tags || [])
      .map(tagId => allTags.find(t => t.id.toString() === tagId.toString()))
      .filter(Boolean) as TagData[];

    // --- LÓGICA DE PREVIEW ESTILO WHATSAPP ---
    const renderMessagePreview = () => {
        // CORREÇÃO AQUI: Forçamos 'as string' para evitar erro de tipo se 'revoked' não estiver na interface
        const type = (chat.last_message_type || 'text') as string;
        const text = chat.last_message;
        const sender = chat.last_message_sender || 'contact';
        
        // Determina se fui eu que enviei
        const isMe = ['HUMAN_AGENT', 'AI_AGENT', 'me'].includes(sender) || 
                     (sender !== 'contact' && sender !== 'CUSTOMER' && sender !== chat.phone);
        
        // Ícone de Status (Checks) - Só aparece se fui EU quem enviou
        let StatusIcon = null;
        if (isMe && type !== 'revoked') { // Não mostra check se a mensagem foi apagada
            if (chat.last_message_status === 'read') {
                StatusIcon = <CheckCheck size={16} className="text-[#53bdeb] shrink-0 mr-1" />; // Azul
            } else if (chat.last_message_status === 'delivered') {
                StatusIcon = <CheckCheck size={16} className="text-[#8696a0] shrink-0 mr-1" />; // Cinza Duplo
            } else {
                StatusIcon = <Check size={16} className="text-[#8696a0] shrink-0 mr-1" />; // Cinza Simples
            }
        }

        // Conteúdo da Mensagem
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
                        <span className={`${textClass} truncate`}>{text || 'Foto'}</span>
                    </div>
                );
                break;
            
            case 'video':
                Content = (
                    <div className="flex items-center min-w-0">
                        <Video size={16} className={`${mediaIconClass} flex-shrink-0`} />
                        <span className={`${textClass} truncate`}>{text || 'Vídeo'}</span>
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
                        <span className={`${textClass} truncate`}>{text || 'Documento'}</span>
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

            default: // text
                Content = (
                    <div 
                        className={`text-[14px] overflow-hidden min-w-0 truncate ${isUnread ? 'text-[#111b21] dark:text-gray-100 font-medium' : 'text-[#667781] dark:text-[#8696a0]'}`}
                        style={{ 
                            display: '-webkit-box',
                            WebkitLineClamp: 1,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            wordBreak: 'break-word',
                            maxHeight: '1.4em',
                            lineHeight: '1.4em'
                        }}
                    >
                        <FormattedMessage 
                            text={text || ""} 
                            className="break-words"
                        />
                    </div>
                );
                break;
        }

        return (
            <div className="flex items-center overflow-hidden w-full h-[20px] min-h-[20px] max-h-[20px]">
                {StatusIcon && (
                    <div className="shrink-0 mr-1 flex-shrink-0">
                        {StatusIcon}
                    </div>
                )}
                <div className="flex-1 min-w-0 overflow-hidden h-full">
                    {Content}
                </div>
            </div>
        );
    };

    return (
      <div 
        onClick={isSelectionMode ? () => onToggleSelection(chat.id) : () => onSelect(chat)}
        className={`group relative flex items-center px-3 py-3 cursor-pointer transition-colors duration-150 ease-in-out border-b border-gray-100 dark:border-gray-800 h-[72px] min-h-[72px] max-h-[72px]
          ${isSelectionMode && isSelectedInMode 
            ? 'bg-primary/10' 
            : isSelected && !isSelectionMode
              ? 'bg-[#f0f2f5] dark:bg-[#202c33]' 
              : 'hover:bg-[#f5f6f6] dark:hover:bg-[#202c33] bg-white dark:bg-[#111b21]'}
        `}
      >
        {/* CHECKBOX DE SELEÇÃO */}
        {isSelectionMode && (
             <div className="absolute left-3 z-10 flex-shrink-0">
                 <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-150 ease-in-out flex-shrink-0 ${isSelectedInMode ? 'bg-[#00a884]' : 'bg-gray-200'}`}>
                    <CheckCheck size={20} className="text-white flex-shrink-0" />
                 </div>
             </div>
        )}

        {/* AVATAR */}
        <div className={`relative shrink-0 mr-3 w-12 h-12 flex-shrink-0 transition-opacity duration-150 ease-in-out ${isSelectionMode ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            <div 
              className="w-12 h-12 rounded-full flex items-center justify-center overflow-hidden border border-gray-100 dark:border-gray-700 flex-shrink-0"
              style={!chat.profile_pic ? { backgroundColor: getAvatarColorHex(chat.id) } : {}}
            >
                {chat.profile_pic ? (
                  <img src={chat.profile_pic} alt="Avatar" className="w-full h-full object-cover"/>
                ) : (
                  <User 
                    className="w-6 h-6 opacity-90 flex-shrink-0" 
                    style={{ color: getAvatarTextColor(chat.id) }}
                  />
                )}
            </div>
        </div>

        {/* CONTEÚDO PRINCIPAL */}
        <div className="flex-1 min-w-0 flex flex-col justify-center h-full gap-0.5 overflow-hidden">
            
            {/* Linha 1: Nome e Hora */}
            <div className="flex justify-between items-center gap-2 min-h-[20px]">
                <h3 className={`text-[16px] truncate leading-tight dark:text-gray-100 flex-1 min-w-0 ${isUnread ? 'font-semibold text-black' : 'font-normal text-[#111b21]'}`}>
                    {chat.contact_name || chat.phone}
                </h3>
                <span className={`text-[12px] shrink-0 dark:text-[#8696a0] whitespace-nowrap flex-shrink-0 ${isUnread ? 'text-[#25d366] font-medium' : 'text-[#667781]'}`}>
                    {formatTime(chat.last_interaction_at)}
                </span>
            </div>
            
            {/* Linha 2: Preview da Mensagem */}
            <div className="flex items-start gap-2 min-h-[20px] max-h-[20px] relative">
                {/* Preview da Mensagem - reserva espaço fixo para os ícones da direita */}
                <div className="flex-1 min-w-0 overflow-hidden h-full" style={{ paddingRight: '70px' }}>
                    {renderMessagePreview()}
                </div>

                {/* Ícones da Direita - posição absoluta, não empurra o preview */}
                <div className="absolute right-0 top-0 flex items-center gap-1 shrink-0 flex-nowrap h-full pointer-events-none">
                    {chat.is_pinned && (
                      <Pin size={14} className="text-[#8696a0] rotate-45 flex-shrink-0 pointer-events-auto" />
                    )}
                    
                    {/* Notificação laranja quando pausado e tiver mensagem não lida */}
                    {chat.is_ai_paused && isUnread && (
                      <span className="bg-orange-500 text-white text-[10px] font-bold h-[20px] min-w-[20px] px-1.5 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse pointer-events-auto" title="Cliente enviou mensagem e foi respondido automaticamente. Aguardando atendimento continuar.">
                        {chat.unread_count}
                      </span>
                    )}
                    
                    {/* Badge verde normal quando não pausado */}
                    {!chat.is_ai_paused && isUnread && (
                      <span className="bg-[#25d366] text-[#111b21] text-[10px] font-bold h-[20px] min-w-[20px] px-1.5 rounded-full flex items-center justify-center flex-shrink-0 pointer-events-auto">
                        {chat.unread_count}
                      </span>
                    )}
                    
                    {/* Botão de menu - sempre visível, apenas muda opacidade no hover */}
                    <button 
                        onClick={(e) => onToggleMenu(e, chat.id)}
                        className="text-[#8696a0] p-1 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 transition-opacity duration-150 flex-shrink-0 w-[26px] h-[26px] flex items-center justify-center pointer-events-auto"
                        style={{ opacity: isMenuOpen ? 1 : 0.3 }}
                    >
                        <ChevronDown size={18} />
                    </button>
                </div>
            </div>

            {/* Linha 3 (Opcional): Tags */}
            {chatTags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-0.5">
                    {chatTags.map((tag, idx) => (
                        <span 
                            key={idx} 
                            className="text-[10px] px-1.5 py-0.5 rounded-[4px] font-medium"
                            style={{ 
                                backgroundColor: tag.color ? `${tag.color}15` : '#e9edef', 
                                color: tag.color || '#667781'
                            }}
                        >
                            {tag.name}
                        </span>
                    ))}
                </div>
            )}
        </div>

        {/* MENU SUSPENSO */}
        {!isSelectionMode && isMenuOpen && (
          <div 
            ref={menuRef}
            className="absolute right-8 top-8 w-52 bg-white dark:bg-[#2a2d36] rounded-lg shadow-lg py-2 z-50 animate-in fade-in zoom-in-95 duration-200 border border-gray-100 dark:border-gray-700 origin-top-right transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={(e) => onAction(e, 'edit_contact', chat)} className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5 text-[#3b4a54] dark:text-gray-200 text-[14.5px] flex items-center gap-3">
              <UserCog size={17} className="text-[#54656f] dark:text-gray-400" /> Editar Contato
            </button>
            <button onClick={(e) => onAction(e, 'tags', chat)} className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5 text-[#3b4a54] dark:text-gray-200 text-[14.5px] flex items-center gap-3">
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
            <div className="my-1 border-t border-gray-100 dark:border-gray-700"></div>
            <button onClick={(e) => onAction(e, 'delete', chat)} className="w-full text-left px-4 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/10 text-red-500 text-[14.5px] flex items-center gap-3">
              <Trash2 size={17} /> Apagar conversa
            </button>
          </div>
        )}
      </div>
    );
});

ChatListItem.displayName = 'ChatListItem';
export default ChatListItem;