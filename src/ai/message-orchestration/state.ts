/**
 * Estados da orquestração de mensagens (delete/send).
 * Usado para decisões consistentes entre API e UI.
 */

export type DeleteTarget = 'everyone' | 'system';

export interface DeleteOrchestrationInput {
  messageId: number | string;
  wppId: string | null | undefined;
  target: DeleteTarget;
  phone: string;
}

export interface DeleteOrchestrationResult {
  /** Chamar Evolution API para apagar no WhatsApp */
  shouldCallEvolution: boolean;
  /** Remover original e persistir tombstone revoked no banco */
  shouldUpdateToRevoked: boolean;
  /** Deletar do banco */
  shouldDeleteFromDb: boolean;
  /** wpp_id ausente: não é possível apagar no WhatsApp */
  skippedNoWppId: boolean;
}

/**
 * Determina as ações a executar para um delete, de forma consistente.
 * - everyone + wpp_id: chamar Evolution, remover original + inserir tombstone revoked no DB
 * - everyone + !wpp_id: não chama Evolution, mas ainda cria tombstone no DB
 * - system: deletar do DB
 */
export function orchestrateDelete(input: DeleteOrchestrationInput): DeleteOrchestrationResult {
  const { target, wppId } = input;

  if (target === 'system') {
    return {
      shouldCallEvolution: false,
      shouldUpdateToRevoked: false,
      shouldDeleteFromDb: true,
      skippedNoWppId: false,
    };
  }

  // target === 'everyone'
  const hasWppId = Boolean(wppId && String(wppId).trim());
  if (hasWppId) {
    return {
      shouldCallEvolution: true,
      shouldUpdateToRevoked: true,
      shouldDeleteFromDb: false,
      skippedNoWppId: false,
    };
  }

  // Sem wppId: não chama Evolution, mas MARCA revoked no banco para manter UI consistente
  return {
    shouldCallEvolution: false,
    shouldUpdateToRevoked: true,
    shouldDeleteFromDb: false,
    skippedNoWppId: true,
  };
}
