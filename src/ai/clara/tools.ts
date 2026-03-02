import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { GoogleGenAI } from "@google/genai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { chatAnalyzerGraph } from "./chatAnalyzerGraph";
import { Pool } from "pg";
// Analyst tools são importados diretamente em graph.ts/researcher_graph.ts — não re-exportar aqui

// Garante bypass de certificado SSL auto-assinado independente da ordem de importação dos módulos.
// O checkpointer.ts também define isso, mas tools.ts pode ser carregado antes em alguns contextos.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// Helper para gerar embeddings 768d compatíveis com o schema vector(768) do banco.
// Usa gemini-embedding-001 via @google/genai (text-embedding-004 não está disponível via v1beta).
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY! });
async function embedText768(text: string): Promise<number[]> {
  const response = await genAI.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
    config: { outputDimensionality: 768 },
  });
  return response.embeddings?.[0]?.values ?? [];
}

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
const EDITABLE_MODULES = ["company", "rules", "voice_rules"] as const;
type EditableModule = (typeof EDITABLE_MODULES)[number];

const MODULE_LABELS: Record<EditableModule, string> = {
  company: "Contexto da Empresa",
  rules: "Regras Personalizadas",
  voice_rules: "Diretrizes de Personalidade da Voz",
};

export const readBrainFilesTool = new DynamicStructuredTool({
  name: "read_brain_files",
  description:
    "Lê o conteúdo atual do contexto da empresa (company) e das regras personalizadas aprendidas (rules) diretamente do banco de dados. Use para consultar sua configuração atual antes de editar.",
  schema: z.object({
    module: z
      .enum(["company", "rules", "voice_rules", "all"])
      .optional()
      .default("all")
      .describe("Qual módulo ler: 'company', 'rules', 'voice_rules' ou 'all' para todos."),
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
    module: z.enum(["company", "rules", "voice_rules"]).describe("Qual módulo atualizar: 'company', 'rules', ou 'voice_rules'."),
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
        const embedding = await embedText768(content);

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
      // Busca vetorial (semântica) quando há conteúdo, ilike como fallback
      if (content) {
        try {
          const queryEmbedding = await embedText768(content);
          const { data: vecMatches, error: vecError } = await supabase.rpc("match_memories", {
            query_embedding: queryEmbedding,
            match_threshold: 0.7,
            match_count: 5,
          });
          if (!vecError && vecMatches && vecMatches.length > 0) {
            return `Memórias encontradas (busca semântica):\n${(vecMatches as any[])
              .map((m) => `- ${m.content} (similaridade: ${(m.similarity * 100).toFixed(0)}%)`)
              .join("\n")}`;
          }
        } catch {
          // Fallback para ilike se a busca vetorial falhar
        }
      }
      // Fallback: busca por categoria + texto
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
            `- ${m.content} (salvo em ${new Date((m as any).created_at).toLocaleDateString()})`
        )
        .join("\n")}`;
    }
  },
});

export const manageChatNotesTool = new DynamicStructuredTool({
  name: "manage_chat_notes",
  description: `Gerencia suas anotações privadas sobre um chat específico.
Use para registrar e atualizar contexto relevante:
- Se é chat interno (equipe) ou de cliente/paciente
- Perfil do contato (interesses, histórico, objeções recorrentes)
- Decisões importantes tomadas no chat
- Qualquer contexto que ajude a orientar interações futuras
As notas são injetadas automaticamente no início de cada conversa como contexto.
Use action='write' para criar ou atualizar. action='read' para consultar explicitamente.`,
  schema: z.object({
    chat_id: z.number().describe("ID numérico do chat"),
    action: z.enum(["read", "write"]).describe("read: consulta as notas existentes | write: cria ou atualiza as notas"),
    notes: z.string().optional().describe("Conteúdo das notas (obrigatório quando action=write)"),
  }),
  func: async ({ chat_id, action, notes }) => {
    if (action === "read") {
      const { data, error } = await supabase
        .from("chat_notes")
        .select("notes, updated_at")
        .eq("chat_id", chat_id)
        .single();
      if (error || !data) return "Nenhuma observação registrada para este chat.";
      const updatedAt = new Date(data.updated_at).toLocaleString("pt-BR");
      return `Observações sobre o chat ${chat_id} (atualizado em ${updatedAt}):\n\n${data.notes}`;
    }
    // action === "write"
    if (!notes?.trim()) return "Erro: o campo notes é obrigatório para action=write.";
    const { error } = await supabase
      .from("chat_notes")
      .upsert(
        { chat_id, notes: notes.trim(), updated_at: new Date().toISOString() },
        { onConflict: "chat_id" }
      );
    if (error) return `Erro ao salvar observações: ${error.message}`;
    return `Observações do chat ${chat_id} atualizadas com sucesso.`;
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
  if (s === "CONTACT") return "PACIENTE";
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
          model: "gemini-3-flash-preview",
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
        model: "gemini-3-flash-preview",
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
      const fetchInsights = async (days: number) => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        return supabase
          .from("chat_insights")
          .select("id, chat_id, nota_atendimento, sentimento, gargalos, resumo_analise, metricas_extras, updated_at")
          .gte("updated_at", cutoff.toISOString())
          .order("updated_at", { ascending: false });
      };

      let { data, error } = await fetchInsights(dias_retroativos);
      if (error) throw error;

      // Auto-expansão de janela: se não há dados no período solicitado, tenta janelas maiores
      let periodoEfetivo = dias_retroativos;
      if (!data || data.length === 0) {
        for (const fallback of [60, 90, 180]) {
          const res = await fetchInsights(fallback);
          if (!res.error && res.data && res.data.length > 0) {
            data = res.data;
            periodoEfetivo = fallback;
            break;
          }
        }
      }

      if (!data || data.length === 0) return "Nenhum insight de chat encontrado. Execute get_filtered_chats_list e depois analisar_chat_especifico para gerar insights em tempo real.";

      // Busca nome e telefone dos chats em uma única query (JOIN programático)
      const chatIds = (data as any[]).map((d) => d.chat_id).filter(Boolean);
      const { data: chatsData } = await supabase
        .from("chats")
        .select("id, contact_name, phone")
        .in("id", chatIds);
      const chatMetaMap = new Map<number, { name: string; phone: string }>(
        ((chatsData ?? []) as any[]).map((c) => [
          c.id as number,
          {
            name: (c.contact_name as string) || "",
            phone: (c.phone as string) || "",
          },
        ])
      );

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

      // Resumo por chat (os 20 mais recentes) — inclui nome e telefone para links auditáveis
      const chatSummaries = (data as any[]).slice(0, 20).map((d) => {
        const extras = d.metricas_extras as Record<string, any> | null;
        const objs = extras?.todas_objecoes?.join("; ") || "nenhuma";
        const decisao = extras?.decisao || d.resumo_analise?.substring(0, 80) || "não identificada";
        const meta = chatMetaMap.get(d.chat_id as number);
        const label = meta?.name && meta?.phone
          ? `${meta.name} (${meta.phone})`
          : meta?.name || meta?.phone || `#${d.chat_id}`;
        // Formato de link clicável para auditoria
        return `[[chat:${d.chat_id}|${label}]] | Nota: ${d.nota_atendimento ?? "N/A"}/10 | Sentimento: ${d.sentimento ?? "N/A"} | Objeções: ${objs} | Decisão: ${decisao}`;
      });

      return JSON.stringify({
        periodo_analisado: `últimos ${periodoEfetivo} dia(s)${periodoEfetivo !== dias_retroativos ? ` (solicitado: ${dias_retroativos} dias — expandido automaticamente pois não havia dados no período original)` : ""}`,
        total_chats_analisados: data.length,
        media_nota_atendimento: media,
        distribuicao_sentimento: countFreq(sentimentos),
        principais_objecoes: countFreq(allObjecoes).slice(0, 15),
        principais_gargalos: countFreq(allGargalos).slice(0, 10),
        resumo_por_chat: chatSummaries,
        instrucao: "Use os links [[chat:ID|Nome (Tel)]] acima para criar a tabela de auditoria '📎 Chats Analisados' no relatório.",
      });
    } catch (e: any) {
      return `Erro ao buscar relatórios de qualidade: ${e.message}`;
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// FERRAMENTA SQL DIRETA — execute_sql
// Padrão "SQL Agent": o modelo principal escreve o SQL; a ferramenta executa.
// Elimina o LLM intermediário do generateSqlReport e o pg Pool instável.
// ─────────────────────────────────────────────────────────────────────────────

const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 8000,
  idleTimeoutMillis: 30000,
  max: 5,
});

export const executeSqlTool = new DynamicStructuredTool({
  name: "execute_sql",
  description:
    "Executa uma query SQL SELECT diretamente no banco PostgreSQL da clínica. " +
    "Use para QUALQUER consulta de dados: JOINs, aggregations, agendamentos, financeiro, pacientes, leads. " +
    "Você escreve o SQL — a ferramenta apenas executa e retorna os resultados brutos. " +
    "REGRAS OBRIGATÓRIAS: (1) Apenas SELECT/WITH. " +
    "(2) Datas sempre com offset BRT: '2026-02-24T00:00:00-03:00'::timestamptz. " +
    "(3) Agrupar por dia BRT: DATE(campo AT TIME ZONE 'America/Sao_Paulo'). " +
    "(4) Para contar chats: filtre last_interaction_at na tabela chats — NUNCA JOIN com chat_messages para isso. " +
    "(5) Inclua LIMIT (máx 500).",
  schema: z.object({
    sql: z.string().describe(
      "Query SQL SELECT completa e válida para PostgreSQL. " +
      "Ex1 — volume por dia: SELECT DATE(last_interaction_at AT TIME ZONE 'America/Sao_Paulo') AS dia, COUNT(*) AS total FROM chats WHERE last_interaction_at >= '2026-02-24T00:00:00-03:00'::timestamptz AND last_interaction_at <= '2026-02-28T23:59:59.999-03:00'::timestamptz GROUP BY 1 ORDER BY 1; " +
      "Ex2 — breakdown por stage: SELECT stage, COUNT(*) FROM chats WHERE last_interaction_at >= '2026-02-24T00:00:00-03:00'::timestamptz GROUP BY stage;"
    ),
  }),
  func: async ({ sql }) => {
    try {
      if (!process.env.DATABASE_URL) {
        return "Erro: DATABASE_URL não configurada. Use get_volume_metrics para métricas de volume.";
      }

      const trimmed = sql.trim();
      const upper = trimmed.replace(/\s+/g, " ").toUpperCase();
      if (!upper.startsWith("SELECT") && !upper.startsWith("WITH")) {
        return `Segurança: apenas SELECT/WITH são permitidos. SQL recebido: ${trimmed.substring(0, 200)}`;
      }

      const client = await dbPool.connect();
      try {
        const result = await client.query(trimmed);
        const rows = result.rows;

        if (rows.length === 0) {
          return `Consulta executada — 0 registros encontrados.\nSQL: ${trimmed}\nDica: verifique o intervalo de datas e os valores dos filtros.`;
        }

        const displayed = rows.slice(0, 500);
        const truncNote = rows.length > 500 ? ` (mostrando 500 de ${rows.length})` : "";
        return `✅ ${rows.length} registro(s)${truncNote}.\nSQL: ${trimmed}\n${JSON.stringify(displayed, null, 2)}`;
      } finally {
        client.release();
      }
    } catch (e: any) {
      return `Erro SQL: ${e.message}\nSQL tentado: ${sql.substring(0, 400)}\nDica: verifique nomes de tabelas/colunas e syntax PostgreSQL.`;
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// FERRAMENTA DETERMINÍSTICA DE VOLUME — get_volume_metrics
// Usa o Supabase SDK (cliente admin, sem DATABASE_URL) + agregação em JavaScript.
// Elimina dependência do pg Pool que pode ter problemas de conexão/SSL.
// ─────────────────────────────────────────────────────────────────────────────

// Converte qualquer timestamp ISO para data YYYY-MM-DD no fuso de Brasília.
function toBRTDateStr(isoStr: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(isoStr));
}

// Pagina resultados do Supabase (limite padrão = 1000 por request).
async function supabaseQueryAll<T>(
  queryBuilder: (range: [number, number]) => Promise<{ data: T[] | null; error: any }>
): Promise<T[]> {
  const results: T[] = [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await queryBuilder([offset, offset + PAGE - 1]);
    if (error) throw error;
    if (!data || data.length === 0) break;
    results.push(...data);
    if (data.length < PAGE) break;
  }
  return results;
}

export const getVolumeMetricsTool = new DynamicStructuredTool({
  name: "get_volume_metrics",
  description:
    "Ferramenta PRIORITÁRIA e DETERMINÍSTICA para relatórios de volume comercial. " +
    "Retorna contagens precisas de chats ativos e mensagens por dia, usando o Supabase SDK (zero risco de falha de conexão). " +
    "Use SEMPRE que precisar: 'quantas conversas tivemos esta semana', 'volume dia a dia', " +
    "'relatório de atividade do período', 'picos de demanda', 'total de interações', 'engajamento'. " +
    "Retorna: volume diário de chats e mensagens, totais do período, breakdown por stage e sentimento.",
  schema: z.object({
    start_date: z.string().describe("Data inicial no formato YYYY-MM-DD (ex: '2026-02-24')."),
    end_date: z.string().describe("Data final no formato YYYY-MM-DD (ex: '2026-02-28')."),
  }),
  func: async ({ start_date, end_date }) => {
    try {
      // Timestamps com offset BRT (-03:00) garantem filtro correto no fuso de Brasília
      const startTs = `${start_date}T00:00:00-03:00`;
      const endTs = `${end_date}T23:59:59.999-03:00`;

      // Busca chats com atividade no período — paginado via Supabase SDK
      const chatRows = await supabaseQueryAll<{
        id: number;
        last_interaction_at: string;
        created_at: string | null;
        stage: string | null;
        ai_sentiment: string | null;
        is_archived: boolean | null;
      }>(([from, to]) =>
        supabase
          .from("chats")
          .select("id, last_interaction_at, created_at, stage, ai_sentiment, is_archived")
          .gte("last_interaction_at", startTs)
          .lte("last_interaction_at", endTs)
          .range(from, to) as any
      );

      // Diagnóstico quando nenhum chat encontrado no período
      if (chatRows.length === 0) {
        const { data: diagData } = await supabase
          .from("chats")
          .select("last_interaction_at")
          .not("last_interaction_at", "is", null)
          .order("last_interaction_at", { ascending: false })
          .limit(1);
        return JSON.stringify({
          periodo: { start_date, end_date },
          aviso: `Nenhum chat com atividade encontrado entre ${start_date} e ${end_date}.`,
          diagnostico: {
            ultima_interacao_registrada: (diagData as any)?.[0]?.last_interaction_at ?? "N/A",
            sugestao: "Verifique se o período está correto e tente um range de datas que inclua a última interação registrada.",
          },
        });
      }

      // Busca mensagens no período — paginado
      const msgRows = await supabaseQueryAll<{
        created_at: string;
        sender: string | null;
        chat_id: number;
      }>(([from, to]) =>
        supabase
          .from("chat_messages")
          .select("created_at, sender, chat_id")
          .gte("created_at", startTs)
          .lte("created_at", endTs)
          .range(from, to) as any
      );

      // Agrega chats por dia (fuso Brasília)
      const chatsByDay: Record<string, Set<number>> = {};
      for (const chat of chatRows) {
        const day = toBRTDateStr(chat.last_interaction_at);
        if (!chatsByDay[day]) chatsByDay[day] = new Set();
        chatsByDay[day].add(chat.id);
      }

      // Agrega mensagens por dia e por tipo de remetente
      const msgsByDay: Record<string, { total: number; pacientes: number; bot: number; secretaria: number }> = {};
      for (const msg of msgRows) {
        const day = toBRTDateStr(msg.created_at);
        if (!msgsByDay[day]) msgsByDay[day] = { total: 0, pacientes: 0, bot: 0, secretaria: 0 };
        msgsByDay[day].total++;
        const s = String(msg.sender ?? "");
        if (s === "contact") msgsByDay[day].pacientes++;
        else if (s === "AI_AGENT") msgsByDay[day].bot++;
        else if (s === "HUMAN_AGENT") msgsByDay[day].secretaria++;
      }

      // Gera série de datas do período (fuso UTC-neutro: meio-dia UTC para cada dia)
      const allDays: string[] = [];
      const cur = new Date(`${start_date}T12:00:00Z`);
      const endD = new Date(`${end_date}T12:00:00Z`);
      while (cur <= endD) {
        allDays.push(cur.toISOString().slice(0, 10));
        cur.setUTCDate(cur.getUTCDate() + 1);
      }

      const volume_diario = allDays.map((day) => ({
        dia: day,
        chats_ativos: chatsByDay[day]?.size ?? 0,
        total_mensagens: msgsByDay[day]?.total ?? 0,
        msg_pacientes: msgsByDay[day]?.pacientes ?? 0,
        msg_bot: msgsByDay[day]?.bot ?? 0,
        msg_secretaria: msgsByDay[day]?.secretaria ?? 0,
      }));

      // Breakdown por stage e sentimento
      const stageCount: Record<string, number> = {};
      const sentimentCount: Record<string, number> = {};
      for (const chat of chatRows) {
        const stage = String(chat.stage ?? "unknown");
        const sentiment = String(chat.ai_sentiment ?? "unknown");
        stageCount[stage] = (stageCount[stage] ?? 0) + 1;
        sentimentCount[sentiment] = (sentimentCount[sentiment] ?? 0) + 1;
      }

      const por_stage = Object.entries(stageCount)
        .sort((a, b) => b[1] - a[1])
        .map(([stage, total]) => ({ stage, total }));

      const por_sentimento = Object.entries(sentimentCount)
        .sort((a, b) => b[1] - a[1])
        .map(([ai_sentiment, total]) => ({ ai_sentiment, total }));

      // Conta novos chats criados DENTRO do período solicitado
      const startDt = new Date(startTs);
      const endDt = new Date(endTs);
      const novos = chatRows.filter((c) => {
        if (!c.created_at) return false;
        const created = new Date(c.created_at);
        return created >= startDt && created <= endDt;
      }).length;

      return JSON.stringify({
        periodo: { start_date, end_date },
        totais: {
          chats_com_atividade_no_periodo: chatRows.length,
          novos_chats_criados_no_periodo: novos,
          chats_nao_arquivados: chatRows.filter((c) => !c.is_archived).length,
          total_mensagens_no_periodo: msgRows.length,
        },
        volume_diario,
        por_stage,
        por_sentimento,
      });
    } catch (e: any) {
      return `Erro ao buscar métricas de volume: ${e.message}`;
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// FERRAMENTA: criar_agendamento
// ─────────────────────────────────────────────────────────────────────────────

export const criarAgendamentoTool = new DynamicStructuredTool({
  name: "criar_agendamento",
  description:
    "Cria um agendamento de consulta ou retorno no sistema, vinculado ao chat do paciente. " +
    "Use quando o usuário pedir para agendar, marcar ou registrar uma consulta. " +
    "Antes de chamar, confirme com o usuário: nome do paciente, telefone, data e hora desejados e o tipo (consulta ou retorno). " +
    "A tool busca o paciente pelo telefone e o cria automaticamente se não existir.",
  schema: z.object({
    chat_id: z.number().describe("ID numérico do chat vinculado ao paciente (obrigatório)."),
    patient_name: z.string().describe("Nome completo do paciente (criança)."),
    patient_phone: z.string().describe("Telefone do paciente ou responsável, somente dígitos (ex: 5599999999999)."),
    data_hora: z.string().describe("Data e hora do agendamento no formato 'YYYY-MM-DD HH:MM', horário de Brasília (ex: '2026-03-15 09:30')."),
    tipo: z.enum(["consulta", "retorno"]).describe("Tipo do agendamento: 'consulta' para primeira vez ou consulta normal, 'retorno' para revisão."),
    motivo: z.string().optional().describe("Motivo ou queixa principal da consulta (ex: 'febre há 3 dias', 'revisão de crescimento')."),
    patient_sex: z.enum(["M", "F"]).optional().describe("Sexo biológico do paciente: 'M' ou 'F'. Identifique pelo nome ou pela conversa."),
    parent_name: z.string().optional().describe("Nome do pai/mãe/responsável, se identificado na conversa."),
    doctor_name: z.string().optional().describe("Nome do médico responsável. Se não informado, usa o médico padrão da clínica."),
  }),
  func: async ({
    chat_id,
    patient_name,
    patient_phone,
    data_hora,
    tipo,
    motivo,
    patient_sex,
    parent_name,
    doctor_name,
  }) => {
    try {
      // 1. Converte data_hora BRT → UTC para start_time
      const [datePart, timePart] = data_hora.trim().split(" ");
      if (!datePart || !timePart) {
        return `Erro: formato de data_hora inválido. Use 'YYYY-MM-DD HH:MM' (ex: '2026-03-15 09:30').`;
      }
      const startTimeBRT = new Date(`${datePart}T${timePart}:00-03:00`);
      if (isNaN(startTimeBRT.getTime())) {
        return `Erro: data/hora inválida: '${data_hora}'.`;
      }
      const startTimeISO = startTimeBRT.toISOString();

      // 2. Busca paciente pelo telefone — reutiliza se já existir
      const phoneDigits = patient_phone.replace(/\D/g, "");
      let patientId: number | null = null;

      const { data: existingPatient } = await supabase
        .from("patients")
        .select("id")
        .or(`phone.eq.${phoneDigits},phone.eq.+${phoneDigits}`)
        .maybeSingle();

      if (existingPatient?.id) {
        patientId = existingPatient.id;
      } else {
        // Cria paciente mínimo se não existir
        const { data: newPatient, error: patientError } = await supabase
          .from("patients")
          .insert({
            name: patient_name,
            phone: phoneDigits,
            ...(patient_sex ? { biological_sex: patient_sex } : {}),
            active: true,
          })
          .select("id")
          .single();

        if (patientError) {
          console.error("[criar_agendamento] Erro ao criar paciente:", patientError);
          // Continua sem patient_id — o agendamento ainda pode ser salvo
        } else {
          patientId = newPatient?.id ?? null;
        }
      }

      // 3. Busca nome do médico padrão no agent_config se não fornecido
      let resolvedDoctorName = doctor_name?.trim() || "";
      if (!resolvedDoctorName) {
        const { data: configData } = await supabase
          .from("agent_config")
          .select("content")
          .eq("agent_id", "clara")
          .eq("config_key", "company")
          .maybeSingle();
        // Extrai o nome da médica do texto da company (ex: "Dra. Fernanda")
        const match = configData?.content?.match(/Dra?\.\s[\w\s]+/i);
        resolvedDoctorName = match?.[0]?.trim() || "Médico(a)";
      }

      // 4. Insere o agendamento na tabela appointments
      const { data: appointment, error: apptError } = await supabase
        .from("appointments")
        .insert({
          chat_id,
          patient_id: patientId,
          patient_name,
          patient_phone: phoneDigits,
          start_time: startTimeISO,
          status: "scheduled",
          appointment_type: tipo,
          doctor_name: resolvedDoctorName,
          ...(motivo ? { notes: motivo } : {}),
          ...(patient_sex ? { patient_sex } : {}),
          ...(parent_name ? { parent_name } : {}),
        })
        .select("id")
        .single();

      if (apptError) {
        console.error("[criar_agendamento] Erro ao inserir appointment:", apptError);
        return `Erro ao criar agendamento: ${apptError.message}`;
      }

      // 5. Atualiza o stage do chat para 'agendando'
      await supabase
        .from("chats")
        .update({ stage: "agendando" })
        .eq("id", chat_id);

      // 6. Formata confirmação em BRT
      const dataFormatada = new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(startTimeBRT);

      return [
        `✅ Agendamento criado com sucesso!`,
        `  ID: #${appointment.id}`,
        `  Paciente: ${patient_name}${parent_name ? ` (resp: ${parent_name})` : ""}`,
        `  Telefone: ${phoneDigits}`,
        `  Data/Hora: ${dataFormatada}`,
        `  Tipo: ${tipo === "consulta" ? "Consulta" : "Retorno"}`,
        `  Médico(a): ${resolvedDoctorName}`,
        ...(motivo ? [`  Motivo: ${motivo}`] : []),
        `  Status do chat atualizado para 'agendando'.`,
      ].join("\n");
    } catch (e: any) {
      console.error("[criar_agendamento] Erro inesperado:", e);
      return `Erro inesperado ao criar agendamento: ${e.message}`;
    }
  },
});

// Ferramentas do simple_agent (Clara principal).
// ATENÇÃO: Analyst tools (getFilteredChatsListTool, getChatCascadeHistoryTool, getAggregatedInsightsTool)
// e deepResearchChatsTool são adicionados UMA ÚNICA VEZ em graph.ts — não incluir aqui.
export const claraTools = [
  getVolumeMetricsTool,           // Rápida e determinística — use primeiro para volume
  executeSqlTool,                 // SQL direto para qualquer outra consulta
  readBrainFilesTool,
  updateBrainFileTool,
  manageLongTermMemoryTool,
  manageChatNotesTool,
  extractAndSaveKnowledgeTool,
  searchKnowledgeBaseTool,
  saveReportTool,
  analisarChatEspecificoTool,
  gerarRelatorioQualidadeTool,
  criarAgendamentoTool,           // Cria agendamentos de consulta/retorno no sistema
];

// Ferramentas expostas aos Researchers do subgrafo de pesquisa paralela.
// ATENÇÃO: Analyst tools são adicionados UMA ÚNICA VEZ em researcher_graph.ts — não incluir aqui.
export const allResearchTools = [
  getVolumeMetricsTool,           // Rápida e determinística — use primeiro para volume
  executeSqlTool,                 // SQL direto para qualquer outra consulta
  deepResearchChatsTool,
  analisarChatEspecificoTool,
  gerarRelatorioQualidadeTool,
  searchKnowledgeBaseTool,
  manageLongTermMemoryTool,
  saveReportTool,
];