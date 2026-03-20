// ═══════════════════════════════════════════════════════════════════════════
// CAMADA 10: Interactive Questions
// Tool + lógica de perguntas interativas com sugestões clicáveis.
// ═══════════════════════════════════════════════════════════════════════════

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { BaseMessage, HumanMessage, AIMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";

// ── Tipos ──────────────────────────────────────────────────────────────────

export interface InteractiveQuestion {
  question_id: string;
  question: string;
  suggestions: Array<{
    label: string;
    value: string;
    is_recommended: boolean;
    description?: string;
  }>;
  allow_free_text: boolean;
  free_text_placeholder?: string;
  context?: string;
}

export interface GraphCheckpoint {
  question_id: string;
  question: string;
  state: Record<string, unknown>;
  node_name: string;
  created_at: string;
  expires_at: string;
}

// ── Checkpoint store (in-memory) ──────────────────────────────────────────
// LIMITAÇÃO: Este store é in-memory e será perdido em caso de restart/redeploy
// do servidor. Em ambiente serverless (Vercel), cada cold start cria um Map novo.
// Para produção multi-instância, migrar para Redis ou Supabase.

const checkpoints = new Map<string, GraphCheckpoint>();

export async function saveGraphCheckpoint(
  state: Record<string, unknown>,
  questionId: string,
  question: string
): Promise<void> {
  const serialized = {
    ...state,
    messages: serializeMessages((state.messages || []) as BaseMessage[]),
  };
  checkpoints.set(questionId, {
    question_id: questionId,
    question,
    state: serialized,
    node_name: "simple_agent",
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });
}

export async function loadAndDeleteCheckpoint(
  questionId: string
): Promise<GraphCheckpoint | null> {
  const checkpoint = checkpoints.get(questionId);
  if (!checkpoint) return null;
  checkpoints.delete(questionId); // Atomic delete — prevents double-click
  if (new Date(checkpoint.expires_at) < new Date()) return null;
  return checkpoint;
}

// ── Serialização segura de mensagens ──────────────────────────────────────

export interface SerializedMessage {
  type: "human" | "ai" | "system" | "tool";
  content: string;
  name?: string;
  tool_call_id?: string;
  additional_kwargs?: Record<string, unknown>;
}

function serializeMessages(messages: BaseMessage[]): SerializedMessage[] {
  return messages.map((m) => ({
    type: m._getType() as SerializedMessage["type"],
    content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    name: (m as { name?: string }).name,
    tool_call_id: (m as { tool_call_id?: string }).tool_call_id,
    additional_kwargs: m.additional_kwargs,
  }));
}

export function deserializeMessages(serialized: SerializedMessage[]): BaseMessage[] {
  return serialized.map((s) => {
    const opts = { content: s.content, name: s.name, additional_kwargs: s.additional_kwargs };
    switch (s.type) {
      case "human":
        return new HumanMessage(opts);
      case "ai":
        return new AIMessage(opts);
      case "system":
        return new SystemMessage(opts);
      case "tool":
        return new ToolMessage({ ...opts, tool_call_id: s.tool_call_id || "" });
      default:
        return new HumanMessage(opts);
    }
  });
}

// ── Tool: ask_user_question ───────────────────────────────────────────────

export const askUserQuestionTool = new DynamicStructuredTool({
  name: "ask_user_question",
  description: `Faz uma pergunta interativa ao usuário com sugestões clicáveis.
Use quando:
- A pergunta é ambígua (sem período, sem escopo claro)
- Existem múltiplas interpretações possíveis
- Precisa de confirmação antes de uma análise demorada
- O período pedido não tem dados e você quer sugerir alternativas

A pergunta aparece como um card interativo no chat com botões clicáveis.
Sempre inclua uma opção recomendada (is_recommended: true) com base no contexto.
SEMPRE inclua allow_free_text: true para o usuário poder digitar algo diferente.

IMPORTANTE: Após enviar a pergunta, PARE e aguarde a resposta do usuário.
Não continue a execução até receber a resposta.`,

  schema: z.object({
    question: z.string().describe("A pergunta para o usuário. Seja direto e conciso."),
    suggestions: z
      .array(
        z.object({
          label: z.string().describe("Texto curto do botão. Ex: 'Esta semana'"),
          value: z.string().describe("Valor técnico. Ex: 'esta_semana'"),
          is_recommended: z.boolean().describe("true para a opção que você recomenda"),
          description: z.string().optional().describe("Detalhe extra. Ex: '03/03 a 09/03'"),
        })
      )
      .min(2)
      .max(5)
      .describe("2-5 sugestões clicáveis"),
    allow_free_text: z.boolean().default(true).describe("Permitir texto livre. SEMPRE true."),
    free_text_placeholder: z.string().optional().describe("Placeholder do campo de texto livre"),
    context: z.string().optional().describe("Explicação adicional se necessário"),
  }),

  func: async ({ question, suggestions, allow_free_text, free_text_placeholder, context }) => {
    const questionId = crypto.randomUUID();

    return JSON.stringify({
      __type: "interactive_question",
      question_id: questionId,
      question,
      suggestions,
      allow_free_text,
      free_text_placeholder: free_text_placeholder || "Digite sua resposta...",
      context,
    });
  },
});
