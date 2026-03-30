import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { createSchemaAdminClient } from "@/lib/supabase/schemaServer";

// ---------------------------------------------------------------------------
// FERRAMENTA 1: SUGESTÃO DE RESPOSTA IMEDIATA
// ---------------------------------------------------------------------------
const immediateReplySchema = z.object({
  chat_id: z.number().describe("O ID numérico do chat (obrigatório)."),
  draft_text: z.string().describe("A mensagem exata sugerida para o atendente enviar agora."),
  reason: z.string().describe("A justificativa lógica do porquê esta é a resposta ideal neste momento."),
});

export const suggestImmediateReplyTool = new DynamicStructuredTool({
  name: "suggest_immediate_reply",
  description: "Use esta ferramenta APENAS quando o paciente fez uma pergunta pendente ou a conversa atual exige uma resposta imediata da clínica.",
  schema: immediateReplySchema,
  func: async ({ chat_id, draft_text, reason }) => {
    const supabase = createSchemaAdminClient('atendimento');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("chats")
      .update({
        ai_draft_reply: draft_text,
        ai_draft_reason: reason
      })
      .eq("id", chat_id);

    if (error) {
      throw new Error(`Falha ao salvar sugestão imediata para o chat ${chat_id}: ${error.message}`);
    }

    return `Sugestão de resposta imediata salva com sucesso no banco de dados.`;
  },
});

// ---------------------------------------------------------------------------
// FERRAMENTA 2: SUGESTÃO DE AGENDAMENTO (FOLLOW-UP)
// ---------------------------------------------------------------------------
const scheduledMessageSchema = z.object({
  chat_id: z.number().describe("O ID numérico do chat (obrigatório)."),
  draft_text: z.string().describe("O texto da mensagem de acompanhamento (follow-up) a ser agendada para o futuro."),
  scheduled_date: z.string().describe("A data e hora exatas para o disparo, obrigatoriamente no formato ISO 8601 (ex: 2026-02-26T14:30:00.000Z)."),
  reason: z.string().describe("A justificativa estratégica do porquê agendar para esta data e hora específicas."),
});

export const suggestScheduledMessageTool = new DynamicStructuredTool({
  name: "suggest_scheduled_message",
  description: "Use esta ferramenta APENAS quando a conversa chegou a um fim natural, ou o paciente pediu um tempo para pensar, exigindo um agendamento de follow-up (resgate) para as próximas horas ou dias.",
  schema: scheduledMessageSchema,
  func: async ({ chat_id, draft_text, scheduled_date, reason }) => {
    const supabase = createSchemaAdminClient('atendimento');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("chats")
      .update({
        ai_draft_schedule_text: draft_text,
        ai_draft_schedule_date: scheduled_date,
        ai_draft_schedule_reason: reason
      })
      .eq("id", chat_id);

    if (error) {
      throw new Error(`Falha ao salvar sugestão de agendamento para o chat ${chat_id}: ${error.message}`);
    }

    return `Sugestão de agendamento futuro salva com sucesso no banco de dados.`;
  },
});

// ---------------------------------------------------------------------------
// FERRAMENTA 3: IGNORAR AÇÃO (ENCERRAMENTO NATURAL)
// ---------------------------------------------------------------------------
const ignoreSchema = z.object({
  chat_id: z.number().describe("O ID numérico do chat (obrigatório)."),
  reason: z.string().describe("A justificativa lógica do porquê esta conversa deve ser ignorada no momento."),
});

export const suggestIgnoreTool = new DynamicStructuredTool({
  name: "suggest_ignore",
  description: "Use esta ferramenta APENAS quando a mensagem for um ok, um agradecimento final, ou se a conversa não exigir NENHUMA resposta da clínica ou acompanhamento futuro.",
  schema: ignoreSchema,
  func: async ({ chat_id, reason }) => {
    // Apenas sinalizamos no log do servidor que a IA optou por ignorar,
    // sem necessidade de gravar nenhum rascunho inútil no banco de dados.
    console.log(`🤖 [Copiloto Geral] Chat ID ${chat_id} ignorado. Motivo: ${reason}`);
    return `Ação ignorada com sucesso. Nenhuma mensagem ou agendamento gerado.`;
  },
});

// Exportamos todas para acoplamento no Grafo
export const copilotGeralTools = [suggestImmediateReplyTool, suggestScheduledMessageTool, suggestIgnoreTool];
