import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { StateGraph, START, END } from "@langchain/langgraph";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { z } from "zod";
import { createSchemaAdminClient } from "@/lib/supabase/schemaServer";
import { MEMORY_TYPES, mapLegacyType } from "@/ai/clara/memory_types";
import { stripPIIAndReferences, isGeneralizablePattern } from "@/ai/clara/memory_quality";
import { manageLongTermMemoryTool } from "./tools";

// ─────────────────────────────────────────────────────────────────────────────
// STATE DEFINITION
// ─────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MessageRow = Record<string, any>;

export interface ChatAnalysisState {
    chat_id: number;
    messages: MessageRow[];
    formatted_transcript: string;
    insights: {
        topico: string | null;
        nota_atendimento: number | null;
        sentimento: string | null;
        objecoes: string[];
        gargalos: string[];
        decisao: string | null;
        resumo_analise: string | null;
    } | null;
    learnings: Array<{
        memory_type: string;
        content: string;
    }>;
}

const stateChannels = {
    chat_id: {
        reducer: (old: number, current: number) => current ?? old,
        default: () => 0,
    },
    messages: {
        reducer: (old: MessageRow[], current: MessageRow[]) => current ?? old,
        default: (): MessageRow[] => [],
    },
    formatted_transcript: {
        reducer: (old: string, current: string) => current ?? old,
        default: () => "",
    },
    insights: {
        reducer: (old: ChatAnalysisState["insights"], current: ChatAnalysisState["insights"]) => current ?? old,
        default: () => null,
    },
    learnings: {
        reducer: (old: ChatAnalysisState["learnings"], current: ChatAnalysisState["learnings"]) => {
            const newLearnings = Array.isArray(current) ? current : [];
            return [...(old ?? []), ...newLearnings];
        },
        default: () => [],
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────────────────────────────────────────

function normalizeSenderLabel(sender: string | null): string {
    const s = String(sender ?? "").toUpperCase();
    if (s === "AI_AGENT") return "BOT";
    if (s === "HUMAN_AGENT" || s === "ME") return "CLINICA";
    if (s === "CONTACT") return "PACIENTE";
    return "PACIENTE";
}

function toBRT(isoStr: string): string {
    return new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(isoStr));
}

// ─────────────────────────────────────────────────────────────────────────────
// NODES
// ─────────────────────────────────────────────────────────────────────────────

async function fetchDataNode(state: ChatAnalysisState): Promise<Partial<ChatAnalysisState>> {
    const supabase = createSchemaAdminClient("atendimento");

    const { data, error } = await supabase
        .from("chat_messages")
        .select("sender, message_text, bot_message, user_message, message_type, created_at")
        .eq("chat_id", state.chat_id)
        .order("created_at", { ascending: true });

    if (error || !data || data.length === 0) {
        return {
            messages: [],
            formatted_transcript: "[Nenhuma mensagem encontrada para este chat.]",
        };
    }

    const timeline = data
        .map((row: MessageRow) => {
            const content = (
                row.message_text?.trim() ||
                row.user_message?.trim() ||
                row.bot_message?.trim() ||
                ""
            );
            if (!content || row.message_type === "audio" || row.message_type === "image") {
                return null;
            }
            const label = normalizeSenderLabel(row.sender);
            const ts = row.created_at ? `[${toBRT(row.created_at)}] ` : "";
            return `${ts}[${label}]: ${content}`;
        })
        .filter((line: string | null): line is string => line !== null)
        .join("\n");

    return {
        messages: data,
        formatted_transcript: timeline || "[Apenas mensagens de midia na conversa.]",
    };
}

// Marcadores exatos que indicam transcricao vazia
const EMPTY_TRANSCRIPT_MARKERS: string[] = [
    "[Nenhuma mensagem encontrada para este chat.]",
    "[Apenas mensagens de midia na conversa.]",
];

async function analyzeConversationNode(state: ChatAnalysisState): Promise<Partial<ChatAnalysisState>> {
    if (!state.formatted_transcript || EMPTY_TRANSCRIPT_MARKERS.includes(state.formatted_transcript)) {
        return {
            insights: {
                topico: null,
                nota_atendimento: null,
                sentimento: null,
                objecoes: [],
                gargalos: ["sem_texto_analisavel"],
                decisao: null,
                resumo_analise: "Conversa nao continha texto suficiente para analise.",
            },
            learnings: [],
        };
    }

    const model = new ChatGoogleGenerativeAI({
        model: "gemini-3.1-flash-lite-preview",
        apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
        temperature: 0.1,
    });

    const schema = z.object({
        topico: z.string().describe("Assunto principal da conversa em poucas palavras (ex: 'Agendamento de consulta', 'Duvida sobre plano', 'Reclamacao de atendimento')."),
        nota_atendimento: z.number().min(0).max(10).describe("Nota de 0 a 10 avaliando a qualidade do atendimento da clinica (cortesia, clareza, resolutividade)."),
        sentimento: z.enum(["positivo", "neutro", "negativo"]).describe("Sentimento geral do paciente ao final da conversa."),
        objecoes: z.array(z.string()).describe("Lista de objecoes levantadas pelo paciente (ex: 'achou caro', 'longe', 'horario ruim')."),
        gargalos: z.array(z.string()).describe("Lista de problemas ou demoras percebidos (ex: 'demora_na_resposta', 'falta_de_empatia', 'nao_respondeu_pergunta')."),
        decisao: z.string().describe("Qual foi o desfecho? (ex: 'Agendou consulta', 'Visualizou as informacoes mas nao respondeu mais', 'Desistiu por preco')."),
        resumo_analise: z.string().describe("Um paragrafo resumindo o que aconteceu na conversa e o motivo do desfecho."),
        novos_aprendizados: z.array(z.object({
            memory_type: z.string().describe(`Categoria do aprendizado. Valores validos: ${MEMORY_TYPES.join(", ")}`),
            content: z.string().describe("Padrao generalizavel identificado (NUNCA dados individuais de pacientes).")
        })).describe("Padroes generalizaveis revelados na conversa. NAO incluir dados individuais de pacientes.")
    });

    const structuredModel = model.withStructuredOutput(schema);

    const hoje = new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(new Date());

    const systemMessage = new SystemMessage(
        `Voce e um analista de qualidade de atendimento rigoroso. Seu objetivo e analisar a transcricao de uma conversa de WhatsApp entre a CLINICA (recepcao/bot) e um PACIENTE.

CONTEXTO DE DATA: Hoje e ${hoje}. Cada mensagem na transcricao esta marcada com [DD/MM/YYYY HH:MM] indicando exatamente quando foi enviada (horario de Brasilia). Use essas marcacoes para entender a linha do tempo real da conversa -- NAO assuma que toda a conversa aconteceu hoje. O resumo deve mencionar as datas relevantes quando a conversa se estendeu por mais de um dia.

INSTRUCOES:
- Identifique a nota do atendimento, objecoes, gargalos, decisao do cliente e crie um resumo cronologicamente preciso.
- No campo "decisao", mencione quando aconteceu o desfecho (ex: "Agendou consulta em 28/02/2026").
- No campo "resumo_analise", deixe claro o periodo em que a conversa ocorreu.
- No campo "novos_aprendizados": APENAS padroes generalizaveis que se aplicam a multiplos casos. NUNCA dados individuais (nomes, enderecos, telefones de pacientes especificos).`
    );

    const humanMessage = new HumanMessage(`Analise a seguinte conversa do chat_id ${state.chat_id}:\n\n${state.formatted_transcript}`);

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const analysisResult = await structuredModel.invoke([systemMessage, humanMessage]) as any;

        return {
            insights: {
                topico: analysisResult.topico ?? null,
                nota_atendimento: analysisResult.nota_atendimento,
                sentimento: analysisResult.sentimento,
                objecoes: analysisResult.objecoes,
                gargalos: analysisResult.gargalos,
                decisao: analysisResult.decisao,
                resumo_analise: analysisResult.resumo_analise,
            },
            learnings: analysisResult.novos_aprendizados || [],
        };
    } catch (error) {
        console.error("Erro na analise via LLM:", error);
        return {
            insights: {
                topico: null,
                nota_atendimento: null,
                sentimento: null,
                objecoes: [],
                gargalos: ["erro_analise_llm"],
                decisao: null,
                resumo_analise: "Falha na analise via IA estruturada.",
            },
            learnings: [],
        };
    }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function extractKnowledgeNode(_state: ChatAnalysisState): Promise<Partial<ChatAnalysisState>> {
    // Pass-through -- analyse_conversation_node ja extraiu learnings
    return {};
}

async function saveToDbNode(state: ChatAnalysisState): Promise<Partial<ChatAnalysisState>> {
    const supabase = createSchemaAdminClient("atendimento");
    const insights = state.insights;

    if (insights) {
        // 1. Inserir ou atualizar na tabela chat_insights
        const { error: insightsError } = await supabase
            .from("chat_insights")
            .upsert({
                chat_id: state.chat_id,
                topico: insights.topico,
                sentimento: insights.sentimento,
                objecao_principal: insights.objecoes.length > 0 ? insights.objecoes[0] : null,
                decisao: insights.decisao,
                nota_atendimento: insights.nota_atendimento != null ? Math.round(insights.nota_atendimento) : null,
                gargalos: insights.gargalos,
                resumo_analise: insights.resumo_analise,
                novo_conhecimento: state.learnings.length > 0,
                metricas_extras: {
                    todas_objecoes: insights.objecoes,
                },
                updated_at: new Date().toISOString(),
            }, { onConflict: "chat_id" });

        if (insightsError) {
            console.error("Erro ao salvar insights:", insightsError);
        }

        // 2. Salvar aprendizados via manageLongTermMemoryTool (com dedup semantico + quality gate + vault sync)
        if (state.learnings && state.learnings.length > 0) {
            for (const learning of state.learnings) {
                const cleaned = stripPIIAndReferences(learning.content);
                if (cleaned && isGeneralizablePattern(cleaned)) {
                    try {
                        await manageLongTermMemoryTool.invoke({
                            action: "salvar",
                            memory_type: mapLegacyType(learning.memory_type),
                            content: cleaned,
                            source_role: "analyzer_bot",
                        });
                    } catch (err) {
                        console.error("Erro ao salvar learning:", err);
                    }
                }
            }
        }
    }

    return {};
}

// ─────────────────────────────────────────────────────────────────────────────
// GRAPH COMPILATION
// ─────────────────────────────────────────────────────────────────────────────

const workflow = new StateGraph<ChatAnalysisState>({ channels: stateChannels })
    .addNode("fetch_data", fetchDataNode)
    .addNode("analyze_conversation", analyzeConversationNode)
    .addNode("extract_knowledge", extractKnowledgeNode)
    .addNode("save_to_db", saveToDbNode)
    // ...
    .addEdge(START, "fetch_data")
    .addEdge("fetch_data", "analyze_conversation")
    .addEdge("analyze_conversation", "extract_knowledge")
    .addEdge("extract_knowledge", "save_to_db")
    .addEdge("save_to_db", END);

export const chatAnalyzerGraph = workflow.compile();
