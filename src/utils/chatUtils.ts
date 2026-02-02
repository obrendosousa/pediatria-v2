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
  let formatted = text
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      .replace(/~(.*?)~/g, '<del>$1</del>')
      .replace(/```(.*?)```/g, '<code>$1</code>');
  
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  formatted = formatted.replace(urlRegex, (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-[#027eb5] dark:text-[#53bdeb] hover:underline break-all">${url}</a>`);
  return formatted.replace(/\n/g, '<br />');
};

export const formatDuration = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;