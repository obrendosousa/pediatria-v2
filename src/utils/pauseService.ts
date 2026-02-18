import { createClient } from '@/lib/supabase/client';
const supabase = createClient();

/**
 * Gera um UUID v4 usando crypto.randomUUID() (nativo)
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback para navegadores antigos
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Ativa o modo de pausa de atendimento
 * Gera um novo UUID de sessão e salva a mensagem automática
 */
export async function activatePause(message: string): Promise<void> {
  try {
    const pauseSessionId = generateUUID();
    const pauseStartedAt = new Date().toISOString();

    // Atualiza todos os chats para ativar a pausa
    // Nota: A pausa é global, então atualizamos todos os chats ativos
    const { error } = await supabase
      .from('chats')
      .update({
        is_ai_paused: true,
        pause_auto_message: message,
        pause_session_id: pauseSessionId,
        pause_started_at: pauseStartedAt
      })
      .neq('status', 'DELETED');

    if (error) {
      // Verificar se é erro de coluna não existente
      if (error.code === '42703' || error.message?.includes('column') || error.message?.includes('does not exist')) {
        const errorMsg = 'Colunas de pausa não foram criadas no banco. Execute o script SQL: database/add_pause_auto_message_columns.sql';
        console.error('[pauseService]', errorMsg);
        throw new Error(errorMsg);
      }
      console.error('[pauseService] Erro ao ativar pausa:', error);
      throw error;
    }

    console.log('[pauseService] Pausa ativada com sessão:', pauseSessionId);
  } catch (error: any) {
    // Se for erro de coluna não existente, fornecer mensagem mais clara
    if (error?.code === '42703' || error?.message?.includes('column') || error?.message?.includes('does not exist')) {
      const errorMsg = 'Colunas de pausa não foram criadas no banco. Execute o script SQL: database/add_pause_auto_message_columns.sql';
      console.error('[pauseService]', errorMsg);
      throw new Error(errorMsg);
    }
    console.error('[pauseService] Erro ao ativar pausa:', error?.message || error);
    throw error;
  }
}

/**
 * Desativa o modo de pausa de atendimento
 * Limpa os campos de pausa de todos os chats
 */
export async function deactivatePause(): Promise<void> {
  try {
    const { error } = await supabase
      .from('chats')
      .update({
        is_ai_paused: false,
        pause_auto_message: null,
        pause_session_id: null,
        pause_started_at: null
      })
      .neq('status', 'DELETED');

    if (error) {
      // Se for erro de coluna não existente, apenas logar e retornar (não é crítico)
      if (error.code === '42703' || error.message?.includes('column') || error.message?.includes('does not exist')) {
        console.warn('[pauseService] Colunas de pausa não existem. Ignorando desativação.');
        return;
      }
      console.error('[pauseService] Erro ao desativar pausa:', error);
      throw error;
    }

    console.log('[pauseService] Pausa desativada');
  } catch (error: any) {
    // Se for erro de coluna não existente, apenas logar e retornar (não é crítico)
    if (error?.code === '42703' || error?.message?.includes('column') || error?.message?.includes('does not exist')) {
      console.warn('[pauseService] Colunas de pausa não existem. Ignorando desativação.');
      return;
    }
    console.error('[pauseService] Erro ao desativar pausa:', error?.message || error);
    throw error;
  }
}

/**
 * Verifica se o modo de pausa está ativo
 * Retorna true se pelo menos um chat tiver is_ai_paused = true
 */
export async function isPauseActive(): Promise<boolean> {
  try {
    // Primeiro, verificar se as colunas existem tentando uma query simples
    // Se falhar, assumir que as colunas não existem e retornar false
    const { data, error } = await supabase
      .from('chats')
      .select('is_ai_paused, pause_session_id')
      .eq('is_ai_paused', true)
      .not('pause_session_id', 'is', null)
      .neq('status', 'DELETED')
      .limit(1);

    if (error) {
      // Verificar se é erro de coluna não existente
      const errorMessage = error.message || String(error);
      const errorCode = error.code || error.hint || '';
      
      if (
        errorCode === '42703' || 
        errorMessage.includes('column') || 
        errorMessage.includes('does not exist') ||
        errorMessage.includes('pause_auto_message') ||
        errorMessage.includes('pause_session_id')
      ) {
        // Colunas não existem - retornar false silenciosamente
        return false;
      }
      
      // Outro tipo de erro - logar apenas se tiver mensagem útil
      if (errorMessage && errorMessage !== '{}' && errorMessage !== '[object Object]') {
        console.warn('[pauseService] Erro ao verificar pausa:', errorMessage);
      }
      return false;
    }

    return (data && data.length > 0 && data[0].pause_session_id) ? true : false;
  } catch (error: any) {
    // Capturar qualquer erro não esperado
    const errorMessage = error?.message || error?.toString() || String(error);
    
    // Se for erro de coluna não existente, retornar false silenciosamente
    if (
      error?.code === '42703' || 
      errorMessage.includes('column') || 
      errorMessage.includes('does not exist') ||
      errorMessage.includes('pause_auto_message') ||
      errorMessage.includes('pause_session_id')
    ) {
      return false;
    }
    
    // Logar apenas se tiver mensagem útil (não objetos vazios)
    if (errorMessage && errorMessage !== '{}' && errorMessage !== '[object Object]') {
      console.warn('[pauseService] Erro ao verificar pausa:', errorMessage);
    }
    return false;
  }
}

/**
 * Retorna a mensagem automática configurada e o session_id
 */
export async function getPauseConfig(): Promise<{ message: string; sessionId: string } | null> {
  try {
    const { data, error } = await supabase
      .from('chats')
      .select('pause_auto_message, pause_session_id')
      .eq('is_ai_paused', true)
      .neq('status', 'DELETED')
      .not('pause_session_id', 'is', null)
      .limit(1)
      .maybeSingle();

    // Se não encontrou dados ou erro, retornar null
    if (error) {
      // Se for erro de coluna não existente, retornar null silenciosamente
      if (error.code === '42703' || error.message?.includes('column') || error.message?.includes('does not exist')) {
        return null;
      }
      console.error('[pauseService] Erro ao obter configuração de pausa:', error);
      return null;
    }

    if (!data || !data.pause_session_id) {
      return null;
    }

    return {
      message: data.pause_auto_message || '',
      sessionId: data.pause_session_id
    };
  } catch (error: any) {
    // Se for erro de coluna não existente, retornar null silenciosamente
    if (error?.code === '42703' || error?.message?.includes('column') || error?.message?.includes('does not exist')) {
      return null;
    }
    console.error('[pauseService] Erro ao obter configuração de pausa:', error?.message || error);
    return null;
  }
}

/**
 * Verifica se um chat já recebeu mensagem automática nesta sessão de pausa
 */
export async function hasChatReceivedAutoMessage(
  chatId: number,
  pauseSessionId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('id')
      .eq('chat_id', chatId)
      .eq('auto_sent_pause_session', pauseSessionId)
      .limit(1);

    if (error) {
      // Se for erro de coluna não existente, retornar false (assumir que não recebeu)
      if (error.code === '42703' || error.message?.includes('column') || error.message?.includes('does not exist')) {
        return false;
      }
      console.error('[pauseService] Erro ao verificar mensagem automática:', error);
      return false;
    }

    return (data && data.length > 0) ? true : false;
  } catch (error: any) {
    // Se for erro de coluna não existente, retornar false (assumir que não recebeu)
    if (error?.code === '42703' || error?.message?.includes('column') || error?.message?.includes('does not exist')) {
      return false;
    }
    console.error('[pauseService] Erro ao verificar mensagem automática:', error?.message || error);
    return false;
  }
}
