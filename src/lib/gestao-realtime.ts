import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Broadcast de typing indicator no canal do chat.
 */
export async function broadcastTyping(
  supabase: SupabaseClient,
  conversationId: string,
  userId: string,
  isTyping: boolean
) {
  const channel = supabase.channel(`gestao:typing:${conversationId}`)
  await channel.send({
    type: 'broadcast',
    event: isTyping ? 'typing_start' : 'typing_stop',
    payload: { user_id: userId },
  })
}

/**
 * Broadcast de status da Clara (pensando/pronta).
 */
export async function broadcastClaraStatus(
  supabase: SupabaseClient,
  conversationId: string,
  status: 'thinking' | 'done'
) {
  const channel = supabase.channel(`gestao:clara:status`)
  await channel.send({
    type: 'broadcast',
    event: 'clara_status',
    payload: { conversation_id: conversationId, status },
  })
}

/**
 * Nomes dos canais Realtime usados no módulo gestão.
 */
export const GESTAO_CHANNELS = {
  board: (boardId: string) => `gestao:board:${boardId}`,
  task: (taskId: string) => `gestao:task:${taskId}`,
  chat: (conversationId: string) => `gestao:chat:${conversationId}`,
  chatPresence: 'gestao:chat:presence',
  notifications: (userId: string) => `gestao:notifications:${userId}`,
  typing: (conversationId: string) => `gestao:typing:${conversationId}`,
  claraStatus: 'gestao:clara:status',
} as const
