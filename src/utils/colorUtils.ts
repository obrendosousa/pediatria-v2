// --- UTILITÁRIOS DE COR UNIFICADOS ---
// Paleta de cores pastel suave para avatares

export interface ColorPair {
  hex: string;
  tailwind: string;
  textColor: string; // Cor do texto/ícone para contraste
}

// Paleta de cores pastel suave (estética clean/soft)
export const PASTEL_COLORS: ColorPair[] = [
  { hex: '#FFD1DC', tailwind: 'bg-pink-200', textColor: '#be185d' },      // Pastel Pink
  { hex: '#A7C7E7', tailwind: 'bg-blue-200', textColor: '#1e40af' },      // Baby Blue
  { hex: '#AAF0D1', tailwind: 'bg-emerald-200', textColor: '#065f46' },   // Mint Green
  { hex: '#E3E4FA', tailwind: 'bg-purple-200', textColor: '#6b21a8' },    // Lavender
  { hex: '#FFE5B4', tailwind: 'bg-orange-200', textColor: '#9a3412' },    // Peach
  { hex: '#F2C8DD', tailwind: 'bg-pink-200', textColor: '#9f1239' },      // Minimal Rose
  { hex: '#D3DB7F', tailwind: 'bg-lime-300', textColor: '#365314' },      // Lime Ice
  { hex: '#A5DBF8', tailwind: 'bg-cyan-200', textColor: '#164e63' },      // Fairy Sparkles
  { hex: '#BFC6F1', tailwind: 'bg-indigo-200', textColor: '#3730a3' },    // Vodka
  { hex: '#B9CEFB', tailwind: 'bg-blue-300', textColor: '#1e3a8a' },      // Pretty Blue
  { hex: '#FADADD', tailwind: 'bg-pink-100', textColor: '#9f1239' },      // Soft Pink
  { hex: '#DDA0DD', tailwind: 'bg-purple-300', textColor: '#6b21a8' },    // Plum
  { hex: '#B2DFDB', tailwind: 'bg-teal-200', textColor: '#134e4a' },      // Aqua
  { hex: '#FFCCCB', tailwind: 'bg-red-200', textColor: '#991b1b' },       // Light Coral
  { hex: '#E0BBE4', tailwind: 'bg-purple-200', textColor: '#6b21a8' },    // Soft Purple
  { hex: '#FFE4E1', tailwind: 'bg-pink-100', textColor: '#9f1239' },      // Misty Rose
  { hex: '#F0E68C', tailwind: 'bg-yellow-200', textColor: '#854d0e' },    // Khaki
  { hex: '#C8E6C9', tailwind: 'bg-green-200', textColor: '#166534' },     // Light Green
];

// Manter CHAT_COLORS para compatibilidade (usando cores pastel)
export const CHAT_COLORS: ColorPair[] = PASTEL_COLORS;

// Paleta anterior para compatibilidade (classes Tailwind)
export const AVATAR_COLORS = PASTEL_COLORS.map(c => c.tailwind);

/**
 * Retorna a classe Tailwind para cor do avatar baseada em um ID
 * Nota: Recomendado usar getAvatarColorHex com style inline ao invés desta função
 */
export const getAvatarColorClass = (id: number | string): string => {
  if (!id) return PASTEL_COLORS[0].tailwind;
  const numId = typeof id === 'number' 
    ? id 
    : id.toString().split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return PASTEL_COLORS[Math.abs(numId) % PASTEL_COLORS.length].tailwind;
};

/**
 * Retorna a cor hexadecimal para uso no chat baseada em um ID
 */
export const getAvatarColorHex = (id: number | string): string => {
  if (!id) return PASTEL_COLORS[0].hex;
  const numId = typeof id === 'number' 
    ? id 
    : id.toString().split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return PASTEL_COLORS[Math.abs(numId) % PASTEL_COLORS.length].hex;
};

/**
 * Retorna a cor do texto/ícone para contraste adequado com o fundo pastel
 */
export const getAvatarTextColor = (id: number | string): string => {
  if (!id) return PASTEL_COLORS[0].textColor;
  const numId = typeof id === 'number' 
    ? id 
    : id.toString().split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return PASTEL_COLORS[Math.abs(numId) % PASTEL_COLORS.length].textColor;
};

/**
 * Retorna a cor da bolha de mensagem baseada no chatId
 * Mensagens enviadas (isMe) sempre retornam verde padrão do WhatsApp
 * Mensagens recebidas retornam a cor do avatar do chat
 */
export const getChatBubbleColor = (chatId: number | string, isMe: boolean): string => {
  if (isMe) return '#d9fdd3'; // Verde padrão para mensagens enviadas
  return getAvatarColorHex(chatId); // Cor do avatar para mensagens recebidas
};

/**
 * Função de compatibilidade - retorna classe Tailwind (mantida para retrocompatibilidade)
 * @deprecated Use getAvatarColorClass ao invés disso
 */
export const getAvatarColor = (id: number | string): string => {
  return getAvatarColorClass(id);
};
