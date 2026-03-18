/**
 * @deprecated A lógica de auto-resposta de pausa agora roda server-side
 * no webhook (/api/whatsapp/webhook). Este hook é mantido como no-op
 * para não quebrar imports existentes no Sidebar.
 */
export function useAutoPauseMessages() {
  // No-op: auto-resposta de pausa agora é tratada no webhook do servidor
  // via scheduled_messages, garantindo funcionamento mesmo com navegador fechado.
}
