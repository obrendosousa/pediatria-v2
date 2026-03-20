import { GoogleGenAI } from "@google/genai";
import { getSupabaseAdminClient } from "@/lib/automation/adapters/supabaseAdmin";
import { Type, Schema } from "@google/genai";
import { manageLongTermMemoryTool } from "./tools";

// Initialize the new Google GenAI SDK
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
});

/**
 * Garante que uma data ISO caia dentro do horário comercial BRT (seg-sex, 09h-18h).
 * Se fora do horário, avança para o próximo slot válido.
 */
function snapToBusinessHours(isoStr: string): string {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr; // data inválida — retorna como está

    // Trabalha em BRT (UTC-3)
    const brtOffset = -3 * 60; // minutos
    const localMs = d.getTime() + (brtOffset - (-d.getTimezoneOffset())) * 60_000;
    const brt = new Date(localMs);

    let year = brt.getUTCFullYear();
    let month = brt.getUTCMonth();
    let day = brt.getUTCDate();
    let hour = brt.getUTCHours();
    let minute = brt.getUTCMinutes();

    // Se após 18h ou fim de semana (sábado=6, domingo=0), avança para próximo dia útil 9h
    const weekday = brt.getUTCDay(); // 0=dom, 6=sab

    const isWeekend = weekday === 0 || weekday === 6;
    const isAfterHours = hour >= 18;
    const isBeforeHours = hour < 9;

    if (isWeekend || isAfterHours) {
        // Avança para o próximo dia útil às 9h
        const next = new Date(Date.UTC(year, month, day + 1, 12, 0)); // meio-dia UTC para evitar dst issues
        while (next.getUTCDay() === 0 || next.getUTCDay() === 6) {
            next.setUTCDate(next.getUTCDate() + 1);
        }
        year = next.getUTCFullYear(); month = next.getUTCMonth(); day = next.getUTCDate();
        hour = 9; minute = 0;
    } else if (isBeforeHours) {
        hour = 9; minute = 0;
    }

    // Reconstrói em UTC a partir do BRT
    const result = new Date(Date.UTC(year, month, day, hour - brtOffset / 60, minute));
    return result.toISOString();
}

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
                    description: "'ignore': mensagem simples (ok, obrigado, emoji) sem necessidade de ação. 'suggest_reply': pergunta direta, objeção de preço/plano, dúvida clínica, momento crucial de decisão. 'suggest_schedule': paciente adiou ('vou pensar', 'depois vejo', 'vou falar com meu marido/esposa/responsável'), conversa esfriou sem retorno do paciente, proposta enviada sem resposta, agendamento confirmado mas sem contato há mais de 3 dias, nutrição de relacionamento pós-consulta.",
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

        // 1. Fetch the last 50 messages for context (15 era insuficiente e causava
        // classificações erradas — ex: paciente classificado como "perdido" quando
        // na verdade tinha agendado, porque a conversão ficava fora da janela de 15 msgs)
        const { data: messages } = await supabase
            .from("chat_messages")
            .select("sender, message_text, created_at, message_type")
            .eq("chat_id", chatId)
            .order("created_at", { ascending: false })
            .limit(50);

        if (!messages || messages.length < 2) return;

        // 2. Format transcript
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const history = messages.reverse().map((m: Record<string, any>) => {
            const senderStr = String(m.sender || "").toUpperCase();
            const label = senderStr === "AI_AGENT" ? "CLARA" : senderStr.includes("HUMAN") ? "CLÍNICA" : "PACIENTE";
            const txt = m.message_text || `[Mídia enviada: ${m.message_type}]`;
            return `[${label}]: ${txt}`;
        }).join("\n");

        const hoje = new Intl.DateTimeFormat("pt-BR", {
            timeZone: "America/Sao_Paulo",
            weekday: "long", day: "2-digit", month: "long", year: "numeric",
        }).format(new Date());

        const prompt = `Você é a Clara, analista de inteligência de uma clínica pediátrica.
Sua missão: ler o histórico desta conversa no WhatsApp e decidir a melhor ação para a secretária Joana.

DATA DE HOJE: ${hoje}

HISTÓRICO DA CONVERSA:
-------------------------------------------------
${history}
-------------------------------------------------

REGRA CRÍTICA DE CLASSIFICAÇÃO DE DESFECHO:
- Leia a conversa INTEIRA antes de decidir o desfecho. NUNCA classifique como perda/desistência
  se houver QUALQUER sinal posterior de conversão (paciente enviou dados, confirmou, disse "sim").
- Se o paciente fez objeção MAS depois aceitou reagendar ou forneceu dados → é CONVERSÃO, não perda.
- Objeção seguida de aceitação = caso de SUCESSO no contorno de objeção.

REGRAS DE DECISÃO:
- 'ignore': mensagem simples (ok, obrigado, emoji, confirmação de leitura) sem ação necessária.
- 'suggest_reply': pergunta direta do paciente, objeção de preço/convênio, dúvida clínica, momento de decisão.
- 'suggest_schedule': use quando identificar QUALQUER UMA das situações abaixo:
    • Paciente adiou: "vou pensar", "depois eu vejo", "vou falar com meu marido/esposa/responsável"
    • Paciente recebeu informações (preço, horário) e parou de responder
    • A última mensagem foi da CLÍNICA e o paciente não respondeu (conversa esfriada)
    • Agendamento realizado — nutrição pós-consulta ou lembrete de retorno
    • Paciente demonstrou interesse mas não avançou

PARA suggest_schedule:
- 'draft_text': escreva uma mensagem de follow-up empática, natural e personalizada baseada no contexto real da conversa. Tom humano, não robótico. Sugira próximos passos concretos.
- 'schedule_date': data/hora em ISO 8601 para envio. Considere: 1-3 dias após o adiamento, ou 1 semana para nutrição. O horário DEVE ser durante horário comercial (seg-sex, 09h-18h, horário de Brasília).

PARA strategic_insight: apenas padrões generalizáveis (objeções recorrentes, falhas do processo). NUNCA dados pessoais.

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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any)
                .from("chats")
                .update({
                    ai_draft_reply: action.draft_text,
                    ai_draft_reason: action.reason
                })
                .eq("id", chatId);
        }
        else if (action.type === "suggest_schedule" && action.draft_text && action.schedule_date) {
            const safeDate = snapToBusinessHours(action.schedule_date);
            console.log(`[Analyzer] Suggesting schedule for chat ${chatId} at ${safeDate}`);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any)
                .from("chats")
                .update({
                    ai_draft_schedule_text: action.draft_text,
                    ai_draft_schedule_date: safeDate,
                    ai_draft_schedule_reason: action.reason
                })
                .eq("id", chatId);
        }
        else {
            console.log(`[Analyzer] Ignoring action for chat ${chatId}. Reason: ${action.reason}`);
            // Não apagar drafts do Copilot — eles são gerados por outro fluxo
        }

    } catch (error) {
        console.error(`[Aliança AI Analyzer] Erro crítico para o chat ${chatId}:`, error);
    }
}
