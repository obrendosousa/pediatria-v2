// Re-exportar funções de colorUtils para compatibilidade
export { 
  getAvatarColor, 
  getAvatarColorClass, 
  getAvatarColorHex, 
  getChatBubbleColor,
  AVATAR_COLORS 
} from './colorUtils';

export const formatWhatsAppText = (text: string) => {
  if (!text) return '';
  // 1. Escapar HTML
  let formatted = text
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // 2. Linkificar URLs ANTES da formatação markdown (evita itálico dentro de URLs)
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urlPlaceholders: string[] = [];
  formatted = formatted.replace(urlRegex, (url) => {
    const safeUrl = url.replace(/["'<>]/g, '');
    const placeholder = `\x00URL${urlPlaceholders.length}\x00`;
    urlPlaceholders.push(`<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-[#027eb5] dark:text-[#53bdeb] hover:underline break-all">${url}</a>`);
    return placeholder;
  });

  // 3. Formatação WhatsApp (bold, italic, strikethrough, code)
  formatted = formatted
      .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
      .replace(/(?<![/\w])_(.*?)_(?!\w)/g, '<em>$1</em>')
      .replace(/~(.*?)~/g, '<del>$1</del>')
      .replace(/```(.*?)```/g, '<code>$1</code>');

  // 4. Restaurar URLs
  urlPlaceholders.forEach((html, i) => {
    formatted = formatted.replace(`\x00URL${i}\x00`, html);
  });

  return formatted.replace(/\n/g, '<br />');
};

export const formatDuration = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;