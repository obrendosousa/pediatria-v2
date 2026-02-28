import { GoogleGenAI } from "@google/genai";
import { getSupabaseAdminClient } from "@/lib/automation/adapters/supabaseAdmin";
import { Type, Schema } from "@google/genai";
import { manageLongTermMemoryTool } from "./tools";

// Initialize the new Google GenAI SDK
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
});

/**
 * Define the strict schema for the Analyzer's structured output.
 * We want exactly two things:
 * 1. Strategic learning (to save to memory, filtering out noise).
 * 2. An actionable recommendation (ignore, or draft a reply/schedule).
 */
const analyzerSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        strategic_insight: {
            type: Type.STRING,
            description: "Apenas preencha se houver uma nova REGRA DE NEGÓCIO, OBJEÇÃO DE VENDA RECORRENTE, ou PREFERÊNCIA CLÍNICA GERAL. Exemplos úteis: 'Pacientes reclamam do preço na primeira consulta', 'A clínica não aceita plano X'. É PROIBIDO extrair nomes de pacientes, CPFs, horários marcados ou detalhes de uma consulta específica. Se for lixo/dados rasos, retorne null.",
            nullable: true,
        },
        action: {
            type: Type.OBJECT,
            description: "A ação imediata que a Clara deve tomar com base na última mensagem.",
            properties: {
                type: {
                    type: Type.STRING,
                    enum: ["ignore", "suggest_reply", "suggest_schedule"],
                    description: "'ignore': se for uma mensagem simples (ok, obrigado) ou que não exige resposta clínica. 'suggest_reply': perguntas, objeções de vendas ou momentos cruciais. 'suggest_schedule': paciente pede tempo para pensar ou a conversa esfriou, exige resgate futuro.",
                },
                draft_text: {
                    type: Type.STRING,
                    description: "O texto pronto para a secretária enviar, se a ação for suggest_reply ou suggest_schedule. Tom empático, humano e de alto nível.",
                    nullable: true,
                },
                reason: {
                    type: Type.STRING,
                    description: "Por que essa ação foi escolhida.",
                },
                schedule_date: {
                    type: Type.STRING,
                    description: "A data ISO futura para envio, ONLY if type is suggest_schedule.",
                    nullable: true,
                },
            },
            required: ["type", "reason"],
        },
    },
    required: ["action"],
};

export async function analyzeChatInteraction(chatId: number) {
    try {
        const supabase = getSupabaseAdminClient();

        // 1. Fetch the last 15 messages for context
        const { data: messages } = await (supabase as any)
            .from("chat_messages")
            .select("sender, message_text, created_at, message_type")
            .eq("chat_id", chatId)
            .order("created_at", { ascending: false })
            .limit(15);

        if (!messages || messages.length < 2) return;

        // 2. Format transcript
        const history = messages.reverse().map((m: any) => {
            const senderStr = String(m.sender || "").toUpperCase();
            const label = senderStr === "AI_AGENT" ? "CLARA" : senderStr.includes("HUMAN") ? "CLÍNICA" : "PACIENTE";
            const txt = m.message_text || `[Mídia enviada: ${m.message_type}]`;
            return `[${label}]: ${txt}`;
        }).join("\n");

        const prompt = `Você é a Analista de Inteligência da Aliança (Clara).
Sua missão é ler silenciosamente o histórico desta conversa no WhatsApp e decidir:
1. Devemos APRENDER algo estratégico com isso? (Regras, objeções frequentes, falhas operacionais? Ignore os dados pessoais do paciente).
2. O agente deve SUGERIR UMA RESPOSTA neste momento crítico ou apenas IGNORAR?

HISTÓRICO DA CONVERSA:
-------------------------------------------------
${history}
-------------------------------------------------

Siga rigorosamente o schema de JSON de saída.`;

        // 3. Call Gemini using Structured Outputs
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: analyzerSchema,
                temperature: 0.1,
            },
        });

        if (!response.text) return;

        const analysis = JSON.parse(response.text);

        // 4. Handle Memory (Strategic Insight ONLY)
        if (analysis.strategic_insight) {
            console.log(`[Analyzer] Salved strategic insight for chat ${chatId}: ${analysis.strategic_insight}`);
            await manageLongTermMemoryTool.invoke({
                action: "salvar",
                memory_type: "insight_observador",
                content: `Insight Validado (Chat ${chatId}): ${analysis.strategic_insight}`,
                source_role: "system"
            });
        }

        // 5. Handle Action (Drafts)
        const action = analysis.action;

        if (action.type === "suggest_reply" && action.draft_text) {
            console.log(`[Analyzer] Suggesting reply for chat ${chatId}`);
            await (supabase as any)
                .from("chats")
                .update({
                    ai_draft_reply: action.draft_text,
                    ai_draft_reason: action.reason
                })
                .eq("id", chatId);
        }
        else if (action.type === "suggest_schedule" && action.draft_text && action.schedule_date) {
            console.log(`[Analyzer] Suggesting schedule for chat ${chatId}`);
            await (supabase as any)
                .from("chats")
                .update({
                    ai_draft_schedule_text: action.draft_text,
                    ai_draft_schedule_date: action.schedule_date,
                    ai_draft_schedule_reason: action.reason
                })
                .eq("id", chatId);
        }
        else {
            console.log(`[Analyzer] Ignoring action for chat ${chatId}. Reason: ${action.reason}`);
            // Optional: Clear existing draft if ignored naturally
            await (supabase as any)
                .from("chats")
                .update({
                    ai_draft_reply: null,
                    ai_draft_reason: null
                })
                .eq("id", chatId);
        }

    } catch (error) {
        console.error(`[Aliança AI Analyzer] Erro crítico para o chat ${chatId}:`, error);
    }
}
