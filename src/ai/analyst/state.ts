import { BaseMessage } from "@langchain/core/messages";

export interface AnalystAgentState {
  // Historico da conversa entre gestor e agente.
  messages: BaseMessage[];
  // Resumo temporario que pode ser atualizado entre interacoes.
  current_analysis_context?: string;
  // Filtros ativos para manter consistencia entre perguntas.
  active_filters?: {
    start_date?: string;
    end_date?: string;
    stage?: string;
  };
}
