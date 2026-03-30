// ═══════════════════════════════════════════════════════════════════════════
// BRECHA 9: Context Compactor (Observation Masking)
// Compacta mensagens antigas em um resumo para manter contexto gerenciável.
// ═══════════════════════════════════════════════════════════════════════════

import { BaseMessage, HumanMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

const MAX_FULL_MESSAGES = 20;
const COMPACTION_TRIGGER = 30;

/**
 * Compacta mensagens quando o histórico excede COMPACTION_TRIGGER.
 * Mantém as últimas MAX_FULL_MESSAGES inteiras e resume as anteriores.
 * SEMPRE preserva a primeira HumanMessage para manter contexto da pergunta original.
 */
export async function compactMessages(
  messages: BaseMessage[]
): Promise<BaseMessage[]> {
  if (messages.length <= COMPACTION_TRIGGER) return messages;

  const cutoff = messages.length - MAX_FULL_MESSAGES;
  const oldMessages = messages.slice(0, cutoff);
  const recentMessages = messages.slice(cutoff);

  // Garantir que a primeira HumanMessage esteja sempre presente
  const firstHuman = messages.find((m) => m._getType() === "human");
  const recentHasHuman = recentMessages.some((m) => m._getType() === "human");

  const oldContent = oldMessages
    .map((m) => {
      const type = m._getType();
      const content = typeof m.content === "string" ? m.content.slice(0, 500) : "[tool_call]";
      return `${type}: ${content}`;
    })
    .join("\n");

  try {
    const compactModel = new ChatGoogleGenerativeAI({
      model: "gemini-3.1-flash-preview",
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
      temperature: 0,
      maxOutputTokens: 300,
    });

    const summaryResponse = await compactModel.invoke([
      {
        role: "system",
        content:
          "Resuma a conversa abaixo em 1-2 parágrafos curtos. Mantenha: datas mencionadas, decisões tomadas, dados pedidos, resultados obtidos. Descarte: saudações e formalidades.",
      },
      { role: "user", content: oldContent },
    ]);

    const summary = typeof summaryResponse.content === "string" ? summaryResponse.content : "";

    const result: BaseMessage[] = [
      new HumanMessage(`[SISTEMA - RESUMO DA CONVERSA ANTERIOR]\n${summary}`),
    ];

    // Se recentMessages não contém HumanMessage, inserir a original
    if (!recentHasHuman && firstHuman) {
      result.push(firstHuman);
    }

    result.push(...recentMessages);
    return result;
  } catch {
    // Se falhar, manter últimas mensagens com a HumanMessage original
    if (!recentHasHuman && firstHuman) {
      return [firstHuman, ...recentMessages];
    }
    return recentMessages;
  }
}
