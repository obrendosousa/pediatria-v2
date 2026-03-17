
import React, { useMemo } from 'react';
import { Emoji, EmojiStyle } from 'emoji-picker-react';

interface FormattedMessageProps {
  text: string;
  className?: string;
  truncateLength?: number;
}

// Regex para detectar Emojis (Suporte moderno para navegadores recentes)
const EMOJI_REGEX = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu;

// Regex de formatação do WhatsApp
const BOLD_REGEX = /\*([^*]+)\*/g;
const ITALIC_REGEX = /_([^_]+)_/g;
const STRIKETHROUGH_REGEX = /~([^~]+)~/g;
const MONOSPACE_REGEX = /```([^`]+)```/g;
const INLINE_CODE_REGEX = /`([^`]+)`/g;
const URL_REGEX = /(https?:\/\/[^\s<]+[^\s<.,;:!?)"'\]])/g;

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
                    size={truncateLength ? 16 : 22}
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

    // Função para processar URLs em links clicáveis
    const processUrls = (inputText: string, keyPrefix: string): React.ReactNode[] => {
      const parts = inputText.split(URL_REGEX);
      return parts.map((part, index) => {
        if (part.match(URL_REGEX)) {
          return (
            <a
              key={`${keyPrefix}-url-${index}`}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 dark:text-blue-400 underline hover:text-blue-600 dark:hover:text-blue-300 break-all"
            >
              {part}
            </a>
          );
        }
        return processTextAndEmojis(part, `${keyPrefix}-${index}`);
      }).flat();
    };

    // Função para processar formatação inline (negrito, itálico, tachado, monospace)
    const processInlineFormatting = (line: string, lineIdx: number): React.ReactNode[] => {
      // Primeiro: monospace de bloco ```texto```
      const monoBlockParts = line.split(MONOSPACE_REGEX);

      return monoBlockParts.flatMap((part, mbIdx) => {
        const isMonoBlock = mbIdx % 2 === 1;
        if (isMonoBlock) {
          return [
            <code key={`${lineIdx}-mb-${mbIdx}`} className="bg-gray-200 dark:bg-[#2d2d36] px-1.5 py-0.5 rounded text-sm font-mono">
              {part}
            </code>
          ];
        }

        // Inline code `texto`
        const inlineCodeParts = part.split(INLINE_CODE_REGEX);

        return inlineCodeParts.flatMap((icPart, icIdx) => {
          const isInlineCode = icIdx % 2 === 1;
          if (isInlineCode) {
            return [
              <code key={`${lineIdx}-ic-${mbIdx}-${icIdx}`} className="bg-gray-200 dark:bg-[#2d2d36] px-1 py-0.5 rounded text-sm font-mono">
                {icPart}
              </code>
            ];
          }

          // Negrito *texto*
          const boldParts = icPart.split(BOLD_REGEX);

          return boldParts.flatMap((bPart, bIdx) => {
            const isBold = bIdx % 2 === 1;

            // Itálico _texto_
            const italicParts = bPart.split(ITALIC_REGEX);

            return italicParts.flatMap((iPart, iIdx) => {
              const isItalic = iIdx % 2 === 1;

              // Tachado ~texto~
              const strikeParts = iPart.split(STRIKETHROUGH_REGEX);

              return strikeParts.map((sPart, sIdx) => {
                const isStrike = sIdx % 2 === 1;

                // Processa URLs e Emojis dentro deste fragmento final
                const contentElements = processUrls(sPart, `${lineIdx}-${mbIdx}-${icIdx}-${bIdx}-${iIdx}-${sIdx}`);

                // Monta o elemento com as tags apropriadas
                let wrapper: React.ReactNode = <>{contentElements}</>;

                if (isStrike) wrapper = <del>{wrapper}</del>;
                if (isItalic) wrapper = <em>{wrapper}</em>;
                if (isBold) wrapper = <strong>{wrapper}</strong>;

                return <React.Fragment key={`${lineIdx}-${mbIdx}-${icIdx}-${bIdx}-${iIdx}-${sIdx}`}>{wrapper}</React.Fragment>;
              });
            });
          });
        });
      });
    };

    // 2. Processamento de Formatação
    const useInlineBreaks = !truncateLength;

    if (useInlineBreaks) {
        // Processa todas as linhas em um único elemento, usando <br /> para quebras
        const lines = displayText.split('\n');
        const result: React.ReactNode[] = [];

        lines.forEach((line, lineIdx) => {
            const lineContent = processInlineFormatting(line, lineIdx);
            result.push(<React.Fragment key={`line-${lineIdx}`}>{lineContent}</React.Fragment>);

            if (lineIdx < lines.length - 1) {
                result.push(<br key={`br-${lineIdx}`} />);
            }
        });

        return result;
    }

    // Modo original com múltiplos divs
    return displayText.split('\n').map((line, lineIdx) => {
        const lineContent = processInlineFormatting(line, lineIdx);
        return (
            <div key={lineIdx} className="min-h-[1.2em]">
                {lineContent}
            </div>
        );
    });

  }, [text, truncateLength]);

  const defaultClasses = !className ? 'break-words text-[#111b21] dark:text-[#e9edef]' : '';

  return (
    <span className={`${defaultClasses} ${className || ''}`}>
        {content}
    </span>
  );
}
