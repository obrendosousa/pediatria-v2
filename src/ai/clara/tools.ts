import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";
import { chatAnalyzerGraph } from "./chatAnalyzerGraph";

// Extrai texto de forma segura de respostas LLM — conteúdo pode ser string ou array de partes.
// Usar .toString() em array retorna "[object Object],[object Object]" — este helper resolve isso.
function extractTextContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((c: any) => (typeof c === "string" ? c : c?.text ?? ""))
      .filter(Boolean)
      .join("");
  }
  return String(content ?? "");
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

// ─────────────────────────────────────────────────────────────────────────────
// FERRAMENTAS ORIGINAIS DA CLARA
// Brain files agora persistidos no Supabase (tabela agent_config)
// para que atualizações entrem em vigor imediatamente sem restart.
// ─────────────────────────────────────────────────────────────────────────────

// Módulos editáveis pela Clara (soul é imutável — definido em system_prompt.ts)
const EDITABLE_MODULES = ["company", "rules"] as const;
type EditableModule = (typeof EDITABLE_MODULES)[number];

const MODULE_LABELS: Record<EditableModule, string> = {
  company: "Contexto da Empresa",
  rules: "Regras Personalizadas",
};

export const readBrainFilesTool = new DynamicStructuredTool({
  name: "read_brain_files",
  description:
    "Lê o conteúdo atual do contexto da empresa (company) e das regras personalizadas aprendidas (rules) diretamente do banco de dados. Use para consultar sua configuração atual antes de editar.",
  schema: z.object({
    module: z
      .enum(["company", "rules", "all"])
      .optional()
      .default("all")
      .describe("Qual módulo ler: 'company', 'rules' ou 'all' para ambos."),
  }),
  func: async ({ module }) => {
    try {
      const keys = module === "all" ? EDITABLE_MODULES : [module as EditableModule];
      const { data, error } = await supabase
        .from("agent_config")
        .select("config_key, content")
        .eq("agent_id", "clara")
        .in("config_key", keys);

      if (error || !data || data.length === 0) return "Nenhum módulo encontrado no banco.";

      const map = Object.fromEntries(data.map((row: any) => [row.config_key, row.content]));
      return keys
        .map((k) => (map[k] ? `### ${MODULE_LABELS[k]}\n${map[k]}` : `### ${MODULE_LABELS[k]}\n(vazio)`))
        .join("\n\n");
    } catch (error: any) {
      return `Erro ao ler configurações: ${error.message}`;
    }
  },
});

export const updateBrainFileTool = new DynamicStructuredTool({
  name: "update_brain_file",
  description:
    "Atualiza o contexto da empresa ('company') ou as regras personalizadas ('rules') no banco de dados. As alterações entram em vigor IMEDIATAMENTE sem precisar reiniciar. Envie o TEXTO COMPLETO que substituirá o módulo — não use código, apenas texto puro.",
  schema: z.object({
    module: z.enum(["company", "rules"]).describe("Qual módulo atualizar: 'company' ou 'rules'."),
    new_content: z.string().describe("O texto completo e atualizado que substituirá o módulo."),
  }),
  func: async ({ module, new_content }) => {
    try {
      const { error } = await supabase
        .from("agent_config")
        .upsert(
          { agent_id: "clara", config_key: module, content: new_content, updated_at: new Date().toISOString() },
          { onConflict: "agent_id,config_key" }
        );
      if (error) throw error;
      return `Sucesso! O módulo '${MODULE_LABELS[module]}' foi atualizado no banco de dados. As alterações já estão ativas.`;
    } catch (error: any) {
      return `Erro ao atualizar configuração: ${error.message}`;
    }
  },
});

export const manageLongTermMemoryTool = new DynamicStructuredTool({
  name: "manage_long_term_memory",
  description: "Salva fatos importantes ou consulta aprendizados passados na tabela 'clara_memories'. No modo salvar faz Upsert Semântico para não duplicar informações similiares.",
  schema: z.object({
    action: z.enum(["salvar", "consultar"]),
    memory_type: z.string().describe("Categoria da memória (ex: 'preferencia_paciente')."),
    content: z.string().optional().describe("O fato a ser salvo ou a palavra-chave para busca."),
    source_role: z.string().optional().default("system").describe("O autor/fonte do conhecimento (ex: 'admin', 'doctor', 'system')."),
  }),
  func: async ({ action, memory_type, content, source_role }) => {
    if (action === "salvar") {
      if (!content) return "Erro: 'content' é obrigatório para salvar.";

      try {
        const embeddings = new GoogleGenerativeAIEmbeddings({
          model: "text-embedding-004",
          apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
        });

        const embedding = await embeddings.embedQuery(content);

        // Chamar a RPC para achar similares (Passo 3)
        const { data: matches, error: rpcError } = await supabase.rpc("match_memories", {
          query_embedding: embedding,
          match_threshold: 0.85,
          match_count: 1
        });

        if (rpcError) throw rpcError;

        if (matches && matches.length > 0) {
          // Upsert Semântico - Encontrou memória muito similar
          const matchedId = matches[0].id;
          const { error: updateError } = await supabase
            .from("clara_memories")
            .update({
              content,
              embedding,
              updated_at: new Date().toISOString()
            })
            .eq("id", matchedId);

          if (updateError) throw updateError;
          return `Memória atualizada com sucesso (Upsert Semântico sobrescrevendo info antiga) na categoria '${memory_type}'.`;
        } else {
          // Inserção normal
          const { error: insertError } = await supabase
            .from("clara_memories")
            .insert({
              memory_type,
              content,
              embedding,
              source_role: source_role || "system",
              updated_at: new Date().toISOString()
            });

          if (insertError) throw insertError;
          return `Nova memória salva com sucesso na categoria '${memory_type}'.`;
        }
      } catch (e: any) {
        return `Erro ao processar memória com embeddings: ${e.message}`;
      }
    } else {
      let query = supabase
        .from("clara_memories")
        .select("content, created_at")
        .eq("memory_type", memory_type);
      if (content) query = query.ilike("content", `%${content}%`);
      const { data, error } = await query.order("created_at", { ascending: false }).limit(5);
      if (error) return `Erro ao buscar memórias: ${error.message}`;
      if (!data || data.length === 0) return "Nenhuma memória encontrada com esses critérios.";
      return `Memórias encontradas:\n${data
        .map(
          (m) =>
            `- ${m.content} (salvo em ${new Date(m.created_at).toLocaleDateString()})`
        )
        .join("\n")}`;
    }
  },
});

export const extractAndSaveKnowledgeTool = new DynamicStructuredTool({
  name: "extract_and_save_knowledge",
  description:
    "Salva um 'gabarito' de atendimento na Base de Conhecimento (tabela knowledge_base). Use isto quando identificar uma excelente resposta humana para uma dúvida comum.",
  schema: z.object({
    pergunta: z.string().describe("A dúvida exata ou intenção do paciente."),
    resposta_ideal: z.string().describe("A resposta perfeita que a equipe deu (o gabarito)."),
    categoria: z.string().describe("Categoria (ex: 'Financeiro', 'Agendamento', 'Dúvida Médica')."),
    tags: z.string().describe("Palavras-chave separadas por vírgula para facilitar a busca."),
  }),
  func: async ({ pergunta, resposta_ideal, categoria, tags }) => {
    const { error } = await supabase
      .from("knowledge_base")
      .insert({ pergunta, resposta_ideal, categoria, tags });
    if (error) return `Erro ao salvar na base de conhecimento: ${error.message}`;
    return `Gabarito salvo com sucesso na base de conhecimento. (Categoria: ${categoria})`;
  },
});

export const searchKnowledgeBaseTool = new DynamicStructuredTool({
  name: "search_knowledge_base",
  description:
    "Busca na sua Base de Conhecimento (gabaritos) se já existe uma resposta padrão aprovada para a dúvida atual de um paciente.",
  schema: z.object({
    termo_busca: z.string().describe("Palavra-chave ou tema da dúvida para buscar no gabarito."),
  }),
  func: async ({ termo_busca }) => {
    const { data, error } = await supabase
      .from("knowledge_base")
      .select("pergunta, resposta_ideal, categoria")
      .or(`pergunta.ilike.%${termo_busca}%,tags.ilike.%${termo_busca}%`)
      .limit(3);

    if (error) return `Erro ao buscar conhecimento: ${error.message}`;
    if (!data || data.length === 0)
      return "Nenhum gabarito encontrado para este tema na sua base de conhecimento.";

    return `Gabaritos Encontrados:\n${data
      .map((d) => `[Categoria: ${d.categoria}]\nQ: ${d.pergunta}\nR: ${d.resposta_ideal}`)
      .join("\n\n")}`;
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// PASSO 2: FERRAMENTA MAP-REDUCE — deep_research_chats
// ─────────────────────────────────────────────────────────────────────────────

const CHUNK_SIZE = 5;

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function normalizeSenderLabel(sender: string | null): string {
  const s = String(sender ?? "").toUpperCase();
  if (s === "AI_AGENT") return "BOT";
  if (s === "HUMAN_AGENT" || s === "ME") return "SECRETÁRIA";
  if (s === "CONTACT") return "BOT";
  return "PACIENTE";
}

export const deepResearchChatsTool = new DynamicStructuredTool({
  name: "deep_research_chats",
  description:
    "Análise rápida e exploratória de múltiplos chats via processamento em lote (Map-Reduce). Use para identificar padrões gerais SEM salvar resultados estruturados no banco. Para análise profunda com salvamento de insights por chat (objeções, nota, gargalos), prefira analisar_chat_especifico.",
  schema: z.object({
    objetivo_da_analise: z
      .string()
      .describe(
        "O objetivo claro da análise (ex: 'Mapear as principais objeções de preço' ou 'Resumir o histórico desses 3 pacientes')."
      ),
    chat_ids: z
      .array(z.number())
      .describe("Lista de IDs numéricos dos chats a serem analisados."),
  }),
  func: async ({ objetivo_da_analise, chat_ids }) => {
    if (chat_ids.length === 0) {
      return "Nenhum chat_id fornecido para análise.";
    }

    const chunks = chunkArray(chat_ids, CHUNK_SIZE);
    const batch_insights: string[] = [];

    // ── MAP: Processa cada lote com um LLM interno ──────────────────────────
    for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
      const chunk = chunks[chunkIdx];
      try {
        const transcripts: string[] = [];

        for (const chatId of chunk) {
          try {
            const { data, error } = await supabase
              .from("chat_messages")
              .select("sender, message_text, bot_message, user_message, message_type, created_at")
              .eq("chat_id", chatId)
              .order("created_at", { ascending: true });

            if (error || !data || data.length === 0) continue;

            const timeline = data
              .map((row) => {
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
              .filter((line): line is string => line !== null)
              .join("\n");

            if (timeline.trim()) {
              transcripts.push(`--- Chat #${chatId} ---\n${timeline}`);
            }
          } catch {
            // Ignora chats individuais que falham sem quebrar o lote
          }
        }

        if (transcripts.length === 0) continue;

        const internalModel = new ChatGoogleGenerativeAI({
          model: "gemini-3-pro-preview",
          apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
          temperature: 0.1,
        });

        const mapPrompt = `Você é um analista de dados restrito e objetivo. Seu objetivo principal é: "${objetivo_da_analise}". 
REGRA DE OURO: Leia as transcrições fornecidas EXATAMENTE como estão. NÃO INVENTE nomes de pacientes, doenças, preços ou situações que não estejam EXPLÍCITAS no texto. Se um chat não tiver nada relevante para o objetivo, apenas ignore-o.
Extraia apenas os pontos relevantes. Responda em formato de lista (bullets).

Transcrições para análise rigorosa:
${transcripts.join("\n\n")}`;

        const response = await internalModel.invoke([new HumanMessage(mapPrompt)]);
        const insight = extractTextContent(response.content).trim();
        if (insight) {
          batch_insights.push(insight);
        }
      } catch (error: any) {
        batch_insights.push(`[Erro no lote ${chunkIdx + 1}: ${error.message}]`);
      }
    }

    if (batch_insights.length === 0) {
      return "Nenhum dado relevante encontrado nos chats fornecidos.";
    }

    if (batch_insights.length === 1) {
      return batch_insights[0];
    }

    // ── REDUCE: Consolida todos os insights em um único relatório ───────────
    try {
      const consolidationModel = new ChatGoogleGenerativeAI({
        model: "gemini-3-pro-preview",
        apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
        temperature: 0.1,
      });

      const reducePrompt = `Você é um Analista de Relatórios rigoroso. 
Aqui estão as análises parciais de ${batch_insights.length} lotes de conversas. 
Seu DEVER é consolidar essas informações em um ÚNICO relatório estruturado focado no objetivo: "${objetivo_da_analise}".

REGRAS DE OURO:
1. NUNCA INVENTE OU DEDUZ DA PRÓPRIA MENTE. 
2. Use EXATAMENTE os dados fornecidos nas análises parciais abaixo. 
3. Se um paciente não for mencionado nas análises parciais, não o invente.
4. Remova duplicações, agrupe os achados por tema e organize por relevância/frequência.

ANÁLISES PARCIAIS:
${batch_insights
          .map((insight, i) => `=== Lote ${i + 1} ===\n${insight}`)
          .join("\n\n")}`;

      const consolidated = await consolidationModel.invoke([new HumanMessage(reducePrompt)]);
      return extractTextContent(consolidated.content);
    } catch {
      return batch_insights.join("\n\n---\n\n");
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// FERRAMENTA DE RELATÓRIO — save_report
// ─────────────────────────────────────────────────────────────────────────────

export const saveReportTool = new DynamicStructuredTool({
  name: "save_report",
  description:
    "Salva um relatório estruturado na tabela 'clara_reports' para visualização como documento HTML formatado. Use após concluir uma análise profunda para disponibilizar o relatório completo ao gestor.",
  schema: z.object({
    titulo: z.string().describe("Título do relatório (ex: 'Análise de Objeções — Fev 2026')."),
    conteudo_markdown: z
      .string()
      .describe(
        "O conteúdo completo do relatório em Markdown. Use títulos, listas e tabelas para estruturar."
      ),
    tipo: z
      .enum(["analise_chats", "financeiro", "agendamento", "geral"])
      .describe("Categoria do relatório."),
  }),
  func: async ({ titulo, conteudo_markdown, tipo }) => {
    try {
      const { data, error } = await supabase
        .from("clara_reports")
        .insert({
          titulo,
          conteudo_markdown,
          tipo,
          created_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (error) throw error;
      const reportId = (data as any)?.id;
      return `Relatório salvo com sucesso! ID: ${reportId}. O gestor pode acessá-lo em /relatorios/${reportId}.`;
    } catch (error: any) {
      return `Erro ao salvar relatório: ${error.message}`;
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// PASSO 3: NOVAS FERRAMENTAS DO SUB-GRAFO DE ANÁLISE
// ─────────────────────────────────────────────────────────────────────────────

export const analisarChatEspecificoTool = new DynamicStructuredTool({
  name: "analisar_chat_especifico",
  description:
    "Análise ESTRUTURADA E PROFUNDA de chats via Sub-Grafo de Análise. Extrai objeções, gargalos, sentimento, nota de atendimento e decisão de CADA conversa individualmente, salvando resultados estruturados na tabela chat_insights. Use quando o usuário pedir 'novo grafo', 'nova ferramenta', 'análise profunda estruturada', ou quando precisar de dados persistidos para relatórios posteriores.",
  schema: z.object({
    chat_ids: z.array(z.number()).describe("Lista de IDs numéricos dos chats a serem analisados (máx. 30 por chamada)."),
  }),
  func: async ({ chat_ids }) => {
    if (!chat_ids || chat_ids.length === 0) return "Nenhum chat_id fornecido.";

    const safeIds = chat_ids.slice(0, 30);

    // ── Busca o chat interno da Clara para enviar status ao indicador ──────
    const { data: claraChat } = await supabase
      .from("chats")
      .select("id")
      .eq("phone", "00000000000")
      .single();
    const claraChatId = (claraChat as any)?.id as number | undefined;

    // ── Envia status ao indicador da Clara via Realtime Broadcast ───────────
    // Aparece no ClaraStatusIndicator (header) — NÃO insere mensagem no chat.
    async function broadcastProgress(status: string): Promise<void> {
      if (!claraChatId) return;
      try {
        await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
          },
          body: JSON.stringify({
            messages: [{ topic: `clara:${claraChatId}`, event: "status", payload: { status } }],
          }),
        });
      } catch { /* falha silenciosa */ }
    }

    // ── Pré-carrega nomes de contato de todos os chats em uma única query ──
    const { data: chatsMeta } = await supabase
      .from("chats")
      .select("id, contact_name")
      .in("id", safeIds);
    const nameMap = new Map<number, string>(
      ((chatsMeta ?? []) as any[]).map((c) => [c.id as number, (c.contact_name as string) ?? `#${c.id}`])
    );

    const scratchpadInsights: string[] = [];
    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < safeIds.length; i++) {
      const chat_id = safeIds[i];
      const name = nameMap.get(chat_id) ?? `#${chat_id}`;
      await broadcastProgress(`tool:🔬 Analisando ${i + 1}/${safeIds.length}: ${name}`);

      try {
        const finalState = await chatAnalyzerGraph.invoke({ chat_id });

        const ins = (finalState.insights as {
          topico?: string | null;
          sentimento?: string | null;
          nota_atendimento?: number | null;
          objecoes?: string[];
          gargalos?: string[];
          decisao?: string | null;
          resumo_analise?: string | null;
        } | null);

        if (ins) {
          const nota = ins.nota_atendimento;
          const semTexto = ins.gargalos?.includes("sem_texto_analisavel");

          if (semTexto) {
            skippedCount++;
          } else {
            successCount++;
          }

          scratchpadInsights.push([
            `Chat #${chat_id} (${name}):`,
            `  Tópico: ${ins.topico ?? "N/A"}`,
            `  Sentimento: ${ins.sentimento ?? "N/A"} | Nota: ${nota ?? "N/A"}/10`,
            `  Objeções: ${ins.objecoes?.join("; ") || "nenhuma"}`,
            `  Gargalos: ${ins.gargalos?.join("; ") || "nenhum"}`,
            `  Decisão: ${ins.decisao ?? "não identificada"}`,
            `  Resumo: ${ins.resumo_analise ?? ""}`,
          ].join("\n"));
        }
      } catch (e: any) {
        errorCount++;
        scratchpadInsights.push(`Chat #${chat_id} (${name}): Erro — ${e.message}`);
      }
    }

    await broadcastProgress(`tool:✅ Sub-Grafo concluído — ${successCount} analisados, ${skippedCount} sem texto`);

    const header = [
      `Sub-Grafo concluído. Total processado: ${safeIds.length} chats.`,
      `  Com análise: ${successCount} | Sem texto suficiente: ${skippedCount} | Erros: ${errorCount}`,
      `  Insights salvos em chat_insights.`,
    ].join("\n");

    if (scratchpadInsights.length === 0) return header;
    return `${header}\n\n## Insights por Chat:\n\n${scratchpadInsights.join("\n\n")}`;
  },
});

export const gerarRelatorioQualidadeTool = new DynamicStructuredTool({
  name: "gerar_relatorio_qualidade_chats",
  description: "Acessa a tabela chat_insights para buscar gargalos, nota de atendimento média e objeções cadastradas recentemente pelas análises do Sub-Grafo. Útil para fazer um consolidado de qualidade.",
  schema: z.object({
    dias_retroativos: z.number().describe("Quantos dias olhar para trás (ex: 7)."),
  }),
  func: async ({ dias_retroativos }) => {
    try {
      const date = new Date();
      date.setDate(date.getDate() - dias_retroativos);

      const { data, error } = await supabase
        .from("chat_insights")
        .select("id, chat_id, nota_atendimento, sentimento, gargalos, resumo_analise, metricas_extras")
        .gte("created_at", date.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return "Nenhum insight de chat encontrado no período especificado.";

      // Agrega métricas
      const notas = (data as any[]).map((d) => d.nota_atendimento).filter((n) => n !== null && n !== undefined) as number[];
      const media = notas.length ? (notas.reduce((a, b) => a + b, 0) / notas.length).toFixed(1) : "N/A";

      const countFreq = (arr: string[]) => {
        const map: Record<string, number> = {};
        for (const item of arr) { map[item] = (map[item] || 0) + 1; }
        return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} (${v}x)`);
      };

      const allObjecoes: string[] = [];
      const allGargalos: string[] = [];
      const sentimentos: string[] = [];

      for (const d of data as any[]) {
        const extras = d.metricas_extras as Record<string, any> | null;
        if (extras?.todas_objecoes && Array.isArray(extras.todas_objecoes)) {
          allObjecoes.push(...extras.todas_objecoes);
        }
        if (d.gargalos && Array.isArray(d.gargalos)) {
          allGargalos.push(...d.gargalos);
        }
        if (d.sentimento) sentimentos.push(d.sentimento);
      }

      // Resumo por chat (os 20 mais recentes)
      const chatSummaries = (data as any[]).slice(0, 20).map((d) => {
        const extras = d.metricas_extras as Record<string, any> | null;
        const objs = extras?.todas_objecoes?.join("; ") || "nenhuma";
        const decisao = extras?.decisao || d.resumo_analise?.substring(0, 60) || "não identificada";
        return `Chat #${d.chat_id} | Nota: ${d.nota_atendimento ?? "N/A"}/10 | Sentimento: ${d.sentimento ?? "N/A"} | Objeções: ${objs} | Decisão: ${decisao}`;
      });

      return JSON.stringify({
        periodo_analisado: `últimos ${dias_retroativos} dia(s)`,
        total_chats_analisados: data.length,
        media_nota_atendimento: media,
        distribuicao_sentimento: countFreq(sentimentos),
        principais_objecoes: countFreq(allObjecoes).slice(0, 15),
        principais_gargalos: countFreq(allGargalos).slice(0, 10),
        resumo_por_chat: chatSummaries,
      });
    } catch (e: any) {
      return `Erro ao buscar relatórios de qualidade: ${e.message}`;
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export const claraTools = [
  readBrainFilesTool,
  updateBrainFileTool,
  manageLongTermMemoryTool,
  extractAndSaveKnowledgeTool,
  searchKnowledgeBaseTool,
  saveReportTool,
  analisarChatEspecificoTool,
  gerarRelatorioQualidadeTool,
];