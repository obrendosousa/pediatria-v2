// Interfaces compartilhadas
export interface TagData {
  id: number;
  name: string;
  color: string;
}

// --- CORES PREDEFINIDAS PARA ETIQUETAS ---
export const TAG_COLORS = [
  '#3b82f6', // Azul
  '#ef4444', // Vermelho
  '#10b981', // Verde
  '#f59e0b', // Laranja
  '#8b5cf6', // Roxo
  '#ec4899', // Rosa
  '#6366f1', // Indigo
  '#14b8a6', // Teal
  '#64748b', // Slate
  '#000000', // Preto
];

// Re-exportar funções de colorUtils para compatibilidade
export { 
  getAvatarColor, 
  getAvatarColorClass, 
  getAvatarColorHex, 
  getChatBubbleColor,
  AVATAR_COLORS 
} from './colorUtils';

// --- FORMATAÇÃO DE TEMPO ---
export const formatTime = (dateString?: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  
  // Se for hoje
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  // Se for ontem
  const yesterday = new Date(); 
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Ontem';
  }
  
  // Se for na última semana
  const diffDays = Math.ceil((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' }).replace('.', '');
  }
  
  // Data completa
  return date.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' });
};