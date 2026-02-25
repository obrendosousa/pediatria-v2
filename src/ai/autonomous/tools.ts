import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/automation/adapters/supabaseAdmin";

const draftSchema = z.object({
  chat_id: z.number().describe("O ID numérico do chat."),
  draft_text: z.string().describe("A mensagem de WhatsApp sugerida para reengajar o cliente."),
  reason: z.string().describe("A justificativa lógica baseada no ai_summary do porquê desta mensagem ser a ideal."),
});

export const saveDraftReplyTool = new DynamicStructuredTool({
  name: "save_draft_reply",
  description: "Salva uma sugestão de mensagem de follow-up no banco de dados para a secretária humana revisar e aprovar.",
  schema: draftSchema,
  func: async ({ chat_id, draft_text, reason }) => {
    const supabase = getSupabaseAdminClient();
    
    // ABORDAGEM ROBUSTA: Aplicamos o casting 'as any' diretamente no cliente Supabase.
    // Isso destrói a inferência de tipos da tabela apenas para esta execução,
    // garantindo que o TypeScript não bloqueie as novas colunas.
    const { error } = await (supabase as any)
      .from("chats")
      .update({ 
        ai_draft_reply: draft_text,
        ai_draft_reason: reason 
      })
      .eq("id", chat_id);

    if (error) {
      throw new Error(`Falha ao salvar rascunho para o chat ${chat_id}: ${error.message}`);
    }

    return `Rascunho salvo com sucesso para o chat ${chat_id}.`;
  },
});

export const autonomousTools = [saveDraftReplyTool];