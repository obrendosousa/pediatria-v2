import { useState } from 'react';
import { Message } from '@/types';
import { Check, CheckCheck, Trash2, BookmarkPlus, ChevronDown, Copy, User } from 'lucide-react';
import AudioMessage from './AudioMessage';
import { getAvatarColorHex, getAvatarTextColor } from '@/utils/colorUtils';
import { Emoji, EmojiStyle } from 'emoji-picker-react';
import FormattedMessage from '@/components/ui/FormattedMessage'; // Importação do novo componente

interface MessageBubbleProps {
  message: Message;
  isMe: boolean;
  chatId: number | string; // ID do chat para determinar cor
  chatPhoto?: string | null;
  showAvatar: boolean;
  sequencePosition: 'single' | 'first' | 'middle' | 'last';
  onDelete: (msg: Message, deleteForEveryone: boolean) => void;
  onSaveMacro: (text: string) => void;
  onPreviewImage: (url: string) => void;
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
  onPreviewImage
}: MessageBubbleProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [imgError, setImgError] = useState(false);

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isSticker = message.message_type === 'sticker';

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
    : isMe 
      ? 'bg-[#d9fdd3] dark:bg-[#005c4b]' 
      : 'bg-white dark:bg-[#202c33]';

  let roundedClass = 'rounded-lg';
  if (!isSticker) {
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

  const marginClass = (sequencePosition === 'first' || sequencePosition === 'middle') && !isSticker
    ? 'mb-[2px]' 
    : 'mb-3';

  const msgStatus = (message as any).status || 'sent';

  const renderContent = () => {
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
      return (
        <>
          <div className="-mt-1 -mx-1 cursor-pointer overflow-hidden rounded-md bg-black/5" onClick={() => onPreviewImage(message.media_url!)}>
            <img 
              src={message.media_url} 
              alt="Mídia" 
              loading="lazy"
              className="w-full h-auto max-h-[350px] object-cover min-w-[200px]" 
            />
          </div>
          {message.message_text && (
            <div className="pt-1">
              {renderTextContent(message.message_text)}
            </div>
          )}
        </>
      );
    }
    
    // 3. Áudio
    if (message.message_type === 'audio' && message.media_url) {
       return (
         <div className="pt-2 pb-0 min-w-[280px]">
            <AudioMessage 
              src={message.media_url as string} 
              isCustomer={!isMe} 
              simpleMode={true} 
            />
         </div>
       );
    }

    // 4. Texto
    return renderTextContent(message.message_text || '');
  };

  // Determinar se é mensagem pendente (ainda não foi salva no banco)
  const isPending = !message.id || String(message.id).startsWith('pending_');
  
  // Animação suave baseada na direção (enviada vs recebida)
  const animationName = isMe ? 'messageSlideInRight' : 'messageSlideInLeft';
  const animationDuration = isPending ? '0.2s' : '0.25s';
  
  return (
    <div 
      className={`group flex w-full ${isMe ? 'justify-end' : 'justify-start'} ${marginClass} select-none`}
      style={{
        animation: `${animationName} ${animationDuration} cubic-bezier(0.16, 1, 0.3, 1) forwards`,
        opacity: 0,
        willChange: 'opacity, transform'
      } as React.CSSProperties}
      onMouseLeave={() => setShowMenu(false)}
    >
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

      {/* BALÃO */}
      <div 
        className={`relative max-w-[85%] md:max-w-[65%] w-fit ${!isSticker ? 'shadow-[0_1px_0.5px_rgba(0,0,0,0.13)]' : ''} ${bgClass} ${roundedClass} ${isSticker ? 'p-0' : 'px-[9px] pb-[22px]'} flex flex-col min-w-[100px]`}
        style={{
          willChange: 'transform'
        }}
      >
        
        {/* Conteúdo */}
        <div className="">
           {renderContent()}
        </div>

        {/* Metadados: Hora + Check */}
        <div className={`absolute bottom-[3px] right-[7px] flex items-center gap-[3px] select-none h-[15px] ${isSticker ? 'bg-black/30 rounded-full px-1.5 py-0.5 backdrop-blur-sm' : ''}`}>
           <span className={`text-[11px] tabular-nums leading-none ${isSticker ? 'text-white font-medium' : 'text-[rgba(17,27,33,0.6)] dark:text-[rgba(255,255,255,0.6)]'}`}>
             {formatTime(message.created_at)}
           </span>
           
           {isMe && !isSticker && (
             <span className={msgStatus === 'read' ? 'text-[#53bdeb]' : 'text-[rgba(17,27,33,0.4)] dark:text-[rgba(255,255,255,0.5)]'}>
               {msgStatus === 'read' ? <CheckCheck size={16} strokeWidth={1.5} /> : <Check size={16} strokeWidth={1.5} />}
             </span>
           )}
        </div>

        {/* Botão de Menu */}
        {!isSticker && (
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className={`absolute top-0 right-0 p-1 m-0.5 rounded-full bg-gradient-to-l from-[rgba(255,255,255,0.95)] via-[rgba(255,255,255,0.8)] to-transparent dark:from-[#202c33] opacity-0 group-hover:opacity-100 transition-all duration-150 z-20 ${showMenu ? 'opacity-100' : ''}`}
              style={{
                transform: showMenu ? 'scale(1.1)' : 'scale(1)',
                transition: 'opacity 0.15s ease-out, transform 0.15s ease-out'
              }}
            >
               <ChevronDown size={18} className="text-[#54656f] dark:text-[#aebac1] drop-shadow-sm"/>
            </button>
        )}

        {/* Dropdown Menu */}
        {showMenu && (
          <div 
            className="absolute right-4 top-4 bg-white dark:bg-[#233138] py-2 rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.15)] z-50 min-w-[160px] border border-gray-100 dark:border-gray-700 origin-top-right"
            style={{
              animation: 'menuSlideIn 0.15s cubic-bezier(0.16, 1, 0.3, 1) forwards',
              opacity: 0,
              transform: 'scale(0.92) translateY(-3px)',
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
                onClick={() => { onSaveMacro(message.message_text || ''); setShowMenu(false); }}
                className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5 text-[14px] text-[#3b4a54] dark:text-gray-200 flex items-center gap-3"
             >
                <BookmarkPlus size={16}/> Salvar Macro
             </button>
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
          </div>
        )}
      </div>
    </div>
  );
}