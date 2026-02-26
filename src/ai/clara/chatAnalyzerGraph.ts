import { BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { StateGraph, START, END } from "@langchain/langgraph";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
});

// ─────────────────────────────────────────────────────────────────────────────
// STATE DEFINITION
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatAnalysisState {
    chat_id: number;
    messages: any[]; // Mensagens brutas do banco
    formatted_transcript: string; // Mensagens formatadas para a IA ler
    insights: {
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
    }>; // Novos conhecimentos identificados (inserções no clara_memories)
}

const stateChannels = {
    chat_id: {
        reducer: (old: number, current: number) => current ?? old,
        default: () => 0,
    },
    messages: {
        reducer: (old: any[], current: any[]) => current ?? old,
        default: () => [] as any[],
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
    if (s === "HUMAN_AGENT" || s === "ME") return "CLÍNICA";
    if (s === "CONTACT") return "BOT";
    return "PACIENTE";
}

// ─────────────────────────────────────────────────────────────────────────────
// NODES
// ─────────────────────────────────────────────────────────────────────────────

async function fetchDataNode(state: ChatAnalysisState): Promise<Partial<ChatAnalysisState>> {
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
        .map((row: any) => {
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
            return `[${label}]: ${content}`;
        })
        .filter((line: string | null): line is string => line !== null)
        .join("\n");

    return {
        messages: data,
        formatted_transcript: timeline || "[Apenas mensagens de mídia na conversa.]",
    };
}

async function analyzeConversationNode(state: ChatAnalysisState): Promise<Partial<ChatAnalysisState>> {
    if (!state.formatted_transcript || state.formatted_transcript.startsWith("[")) {
        return {
            insights: {
                nota_atendimento: null,
                sentimento: null,
                objecoes: [],
                gargalos: ["sem_texto_analisavel"],
                decisao: null,
                resumo_analise: "Conversa não continha texto suficiente para análise.",
            },
            learnings: [],
        };
    }

    const model = new ChatGoogleGenerativeAI({
        model: "gemini-3-pro-preview",
        apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
        temperature: 0.1,
    });

    const schema = z.object({
        nota_atendimento: z.number().min(0).max(10).describe("Nota de 0 a 10 avaliando a qualidade do atendimento da clínica (cortesia, clareza, resolutividade)."),
        sentimento: z.enum(["positivo", "neutro", "negativo"]).describe("Sentimento geral do paciente ao final da conversa."),
        objecoes: z.array(z.string()).describe("Lista de objeções levantadas pelo paciente (ex: 'achou caro', 'longe', 'horário ruim')."),
        gargalos: z.array(z.string()).describe("Lista de problemas ou demoras percebidos (ex: 'demora_na_resposta', 'falta_de_empatia', 'nao_respondeu_pergunta')."),
        decisao: z.string().describe("Qual foi o desfecho? (ex: 'Agendou consulta', 'Visualizou as informações mas não respondeu mais', 'Desistiu por preço')."),
        resumo_analise: z.string().describe("Um parágrafo resumindo o que aconteceu na conversa e o motivo do desfecho."),
        novos_aprendizados: z.array(z.object({
            memory_type: z.string().describe("Categoria do aprendizado (ex: 'preferencia_paciente', 'reacao_a_preco', 'novo_convenio_solicitado')."),
            content: z.string().describe("Fato importante a ser lembrado para o futuro sobre este paciente ou processo.")
        })).describe("Fatos novos e importantes revelados na conversa que devem ser salvos na memória da IA.")
    });

    const structuredModel = model.withStructuredOutput(schema);

    const systemMessage = new SystemMessage(`Você é um analista de qualidade de atendimento rigoroso. Seu objetivo é analisar a transcrição de uma conversa de WhatsApp entre a CLÍNICA (recepção/bot) e um PACIENTE. Identifique exatamente a nota do atendimento, objeções, gargalos, decisão do cliente e crie um resumo do que ocorreu. Identifique também novos aprendizados importantes que devem ir para a memória de longo prazo.`);

    const humanMessage = new HumanMessage(`Analise a seguinte conversa do chat_id ${state.chat_id}:\n\n${state.formatted_transcript}`);

    try {
        const analysisResult = await structuredModel.invoke([systemMessage, humanMessage]) as any;

        return {
            insights: {
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
        console.error("Erro na análise via LLM:", error);
        return {
            insights: {
                nota_atendimento: null,
                sentimento: null,
                objecoes: [],
                gargalos: ["erro_analise_llm"],
                decisao: null,
                resumo_analise: "Falha na análise via IA estruturada.",
            },
            learnings: [],
        };
    }
}

async function extractKnowledgeNode(state: ChatAnalysisState): Promise<Partial<ChatAnalysisState>> {
    // Neste nó, preparamos as memórias identificadas para facilitar o insert ou
    // até acionar o Supabase Vector futuramente se quisermos "Upsert Semântico" aqui mesmo.
    // Como `analyze_conversation_node` já extraiu as `learnings`, retornamos diretamente
    // ou poderíamos acrescentar lógicas extras aqui (verificação de similaridade).
    return {};
}

async function saveToDbNode(state: ChatAnalysisState): Promise<Partial<ChatAnalysisState>> {
    const insights = state.insights;

    if (insights) {
        // 1. Inserir ou atualizar na tabela chat_insights
        // Assumimos que a tabela usa o chat_id como chave ou relacionamos diretamente
        const { error: insightsError } = await supabase
            .from("chat_insights")
            .upsert({
                chat_id: state.chat_id,
                summary: insights.resumo_analise, // compatibilidade com schema atual (assumindo que seja o campo original)
                sentimento: insights.sentimento,
                objecao_principal: insights.objecoes.length > 0 ? insights.objecoes[0] : null,
                decisao: insights.decisao, // (adapte este campo caso não exista originalmente, ou coloque no metricas_extras)
                nota_atendimento: insights.nota_atendimento,
                gargalos: insights.gargalos,
                resumo_analise: insights.resumo_analise,
                metricas_extras: {
                    todas_objecoes: insights.objecoes,
                    decisao: insights.decisao
                },
                updated_at: new Date().toISOString()
            }, { onConflict: "chat_id" }); // Ajuste o onConflict conforme constraint de unicidade no banco (geralmente chat_id)

        if (insightsError) {
            console.error("Erro ao salvar insights:", insightsError);
        }

        // 2. Inserir novos aprendizados na tabela clara_memories
        if (state.learnings && state.learnings.length > 0) {
            // Como não temos acesso aos embeddings no LangGraph rapidamente sem usar a tool,
            // salvaremos diretamento. Se for necessário Upsert Semântico igual na Tool "manage_long_term_memory",
            // devemos adicionar a criação de embbedding aqui via GoogleGenerativeAIEmbeddings.
            const msgsData = state.learnings.map(l => ({
                memory_type: l.memory_type,
                content: l.content,
                source_role: "analyzer_bot",
                updated_at: new Date().toISOString(),
            }));

            const { error: memoriesError } = await supabase
                .from("clara_memories")
                .insert(msgsData);

            if (memoriesError) {
                console.error("Erro ao salvar memories:", memoriesError);
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
    .addNode("extract_knowledge", extractKnowledgeNode) // Opcional/pass-through por enquanto
    .addNode("save_to_db", saveToDbNode)
    // ...
    .addEdge(START, "fetch_data")
    .addEdge("fetch_data", "analyze_conversation")
    .addEdge("analyze_conversation", "extract_knowledge")
    .addEdge("extract_knowledge", "save_to_db")
    .addEdge("save_to_db", END);

export const chatAnalyzerGraph = workflow.compile();
