
import React, { useMemo } from 'react';
import { Emoji, EmojiStyle } from 'emoji-picker-react';

interface FormattedMessageProps {
  text: string;
  className?: string;
  truncateLength?: number;
}

// Regex para detectar Emojis (Suporte moderno para navegadores recentes)
const EMOJI_REGEX = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu;

// Regex de formatação básica do WhatsApp
const BOLD_REGEX = /\*([^*]+)\*/g;
const ITALIC_REGEX = /_([^_]+)_/g;

export default function FormattedMessage({ text, className, truncateLength }: FormattedMessageProps) {
  
  const content = useMemo(() => {
    if (!text) return null;

    // 1. Truncamento (utilizado para previews na sidebar)
    let displayText = text;
    if (truncateLength && text.length > truncateLength) {
        displayText = text.substring(0, truncateLength) + '...';
    }

    // Função auxiliar para processar texto misto (Texto + Emojis)
    const processTextAndEmojis = (inputText: string, keyPrefix: string) => {
       // O split com regex contendo grupo de captura () inclui os separadores no array
       const parts = inputText.split(EMOJI_REGEX);
       
       return parts.map((part, index) => {
          // Verifica se o segmento atual é um emoji
          if (part.match(EMOJI_REGEX)) {
             // Tenta extrair o código hexadecimal para o Emoji
             const unified = part.codePointAt(0)?.toString(16);
             
             if (!unified) return <span key={`${keyPrefix}-char-${index}`}>{part}</span>;

             return (
               <span key={`${keyPrefix}-emoji-${index}`} className="inline-block align-middle mx-[1px]">
                  <Emoji 
                    unified={unified} 
                    emojiStyle={EmojiStyle.APPLE} 
                    size={truncateLength ? 16 : 22} // Tamanho condicional (menor para sidebar)
                  />
               </span>
             );
          }
          
          // Se for texto normal e não estiver vazio
          if (part) {
              return <span key={`${keyPrefix}-text-${index}`}>{part}</span>;
          }
          return null;
       });
    };

    // 2. Processamento de Formatação
    // Prioridade: Quebra de Linha -> Negrito -> Itálico -> Emoji
    
    // Se não há truncateLength (usado em previews), usa quebras de linha inline para funcionar com line-clamp
    const useInlineBreaks = !truncateLength;
    
    if (useInlineBreaks) {
        // Processa todas as linhas em um único elemento, usando <br /> para quebras
        const lines = displayText.split('\n');
        const result: React.ReactNode[] = [];
        
        lines.forEach((line, lineIdx) => {
            // Divide a linha procurando por trechos em negrito (*texto*)
            const boldParts = line.split(BOLD_REGEX);
            
            const lineContent = boldParts.map((part, bIdx) => {
                 // O split regex coloca o conteúdo capturado nos índices ímpares
                 const isBold = bIdx % 2 === 1; 
                 
                 // Divide o trecho procurando por itálico (_texto_)
                 const italicParts = part.split(ITALIC_REGEX);
                 
                 return italicParts.map((subPart, iIdx) => {
                     const isItalic = iIdx % 2 === 1;
                     
                     // Processa os Emojis dentro deste fragmento final
                     const contentElements = processTextAndEmojis(subPart, `${lineIdx}-${bIdx}-${iIdx}`);
                     
                     // Monta o elemento com as tags apropriadas
                     let wrapper = <>{contentElements}</>;
                     
                     if (isItalic) wrapper = <em>{wrapper}</em>;
                     if (isBold) wrapper = <strong>{wrapper}</strong>;
                     
                     return <React.Fragment key={`${lineIdx}-${bIdx}-${iIdx}`}>{wrapper}</React.Fragment>;
                 });
            });
            
            // Adiciona o conteúdo da linha
            result.push(<React.Fragment key={`line-${lineIdx}`}>{lineContent}</React.Fragment>);
            
            // Adiciona <br /> após cada linha exceto a última
            if (lineIdx < lines.length - 1) {
                result.push(<br key={`br-${lineIdx}`} />);
            }
        });
        
        return result;
    }
    
    // Modo original com múltiplos divs (para uso em mensagens completas)
    return displayText.split('\n').map((line, lineIdx) => {
        // Divide a linha procurando por trechos em negrito (*texto*)
        const boldParts = line.split(BOLD_REGEX);
        
        const lineContent = boldParts.map((part, bIdx) => {
             // O split regex coloca o conteúdo capturado nos índices ímpares
             const isBold = bIdx % 2 === 1; 
             
             // Divide o trecho procurando por itálico (_texto_)
             const italicParts = part.split(ITALIC_REGEX);
             
             return italicParts.map((subPart, iIdx) => {
                 const isItalic = iIdx % 2 === 1;
                 
                 // Processa os Emojis dentro deste fragmento final
                 const contentElements = processTextAndEmojis(subPart, `${lineIdx}-${bIdx}-${iIdx}`);
                 
                 // Monta o elemento com as tags apropriadas
                 let wrapper = <>{contentElements}</>;
                 
                 if (isItalic) wrapper = <em>{wrapper}</em>;
                 if (isBold) wrapper = <strong>{wrapper}</strong>;
                 
                 return <React.Fragment key={`${lineIdx}-${bIdx}-${iIdx}`}>{wrapper}</React.Fragment>;
             });
        });

        return (
            <div key={lineIdx} className="min-h-[1.2em]">
                {lineContent}
            </div>
        );
    });

  }, [text, truncateLength]);

  // Se não há className passado, usa classes padrão (para mensagens completas)
  // Se há className passado, usa apenas o que foi passado (para previews customizados)
  const defaultClasses = !className ? 'break-words text-[#111b21] dark:text-[#e9edef]' : '';
  
  return (
    <span className={`${defaultClasses} ${className || ''}`}>
        {content}
    </span>
  );
}