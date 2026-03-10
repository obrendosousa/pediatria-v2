// ═══════════════════════════════════════════════════════════════════════════
// CAMADA 8: Raw Data Analyzer
// Análise direta na fonte — lê mensagens brutas e analisa com IA.
// Substitui gerar_relatorio_qualidade_chats e deep_research_chats.
// ═══════════════════════════════════════════════════════════════════════════

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { getSupabaseAdminClient } from "@/lib/automation/adapters/supabaseAdmin";

interface RawChatMessage {
  id: number;
  chat_id: number;
  sender: string | null;
  message_text: string | null;
  created_at: string;
}

interface ChatInfo {
  id: number;
  contact_name: string | null;
  phone: string | null;
}

function normalizeSender(sender: string | null): string {
  const s = String(sender ?? "").toUpperCase();
  if (s === "HUMAN_AGENT" || s === "ME") return "SECRETÁRIA";
  if (s === "AI_AGENT") return "BOT";
  return "PACIENTE";
}

export const analyzeRawConversationsTool = new DynamicStructuredTool({
  name: "analyze_raw_conversations",
  description: `Lê e analisa as mensagens BRUTAS diretamente da tabela chat_messages.
Use esta ferramenta para QUALQUER análise qualitativa: objeções, padrões de atendimento,
script da secretária, sentimento dos pacientes, gargalos, etc.
NÃO depende de tabelas intermediárias — vai direto na fonte.
Pode analisar TODO o histórico ou um período específico.
ACEITA MÚLTIPLOS OBJETIVOS numa única chamada (mais eficiente que chamar várias vezes).
Retorna análise estruturada com citações reais das conversas.`,

  schema: z.object({
    start_date: z.string().describe("Data início YYYY-MM-DD (BRT). Ex: '2025-12-09'"),
    end_date: z.string().describe("Data fim YYYY-MM-DD (BRT). Ex: '2026-03-09'"),
    analysis_goals: z
      .array(z.string())
      .describe(
        "Lista de objetivos de análise. Pode ser 1 ou mais. Ex: ['Identificar as 5 objeções mais frequentes', 'Analisar padrão de atendimento da secretária']"
      ),
    sender_filter: z
      .enum(["ALL", "CUSTOMER", "HUMAN_AGENT", "AI_AGENT"])
      .optional()
      .describe(
        "Filtrar por tipo de remetente. CUSTOMER=pacientes, HUMAN_AGENT=secretária, AI_AGENT=bot. Default: ALL"
      ),
    include_metadata: z.boolean().optional().default(true).describe("Incluir nome do contato e chat_id para referência cruzada"),
  }),

  func: async ({ start_date, end_date, analysis_goals, sender_filter, include_metadata }) => {
    const supabase = getSupabaseAdminClient();

    const startTs = `${start_date}T00:00:00-03:00`;
    const endTs = `${end_date}T23:59:59.999-03:00`;

    // ── PASSO 1: Carregar mensagens brutas com paginação ──
    let allMessages: RawChatMessage[] = [];
    let offset = 0;
    const BATCH = 1000;

    while (true) {
      let query = supabase
        .from("chat_messages")
        .select("id, chat_id, sender, message_text, created_at")
        .gte("created_at", startTs)
        .lte("created_at", endTs)
        .not("message_text", "is", null)
        .order("created_at", { ascending: true })
        .range(offset, offset + BATCH - 1);

      if (sender_filter && sender_filter !== "ALL") {
        query = query.eq("sender", sender_filter === "CUSTOMER" ? "contact" : sender_filter);
      }

      const { data, error } = await query;
      if (error) return `Erro ao buscar mensagens: ${error.message}`;
      if (!data || data.length === 0) break;

      allMessages = allMessages.concat(data);
      if (data.length < BATCH) break;
      offset += BATCH;
    }

    if (allMessages.length === 0) {
      return (
        `Nenhuma mensagem encontrada no período ${start_date} a ${end_date}` +
        (sender_filter && sender_filter !== "ALL" ? ` com filtro sender=${sender_filter}` : "") +
        ". Verifique se as datas estão corretas."
      );
    }

    // ── PASSO 2: Enriquecer com nomes dos chats ──
    const chatNames: Record<number, string> = {};
    if (include_metadata) {
      const chatIds = [...new Set(allMessages.map((m) => m.chat_id))];
      for (let i = 0; i < chatIds.length; i += 100) {
        const batch = chatIds.slice(i, i + 100);
        const { data } = await supabase.from("chats").select("id, contact_name, phone").in("id", batch);
        if (data) {
          (data as ChatInfo[]).forEach((c) => {
            chatNames[c.id] = `${c.contact_name || "Sem nome"} (${c.phone || "sem tel"})`;
          });
        }
      }
    }

    // ── PASSO 3: Formatar como transcrição ──
    const formatMessage = (m: RawChatMessage) => {
      const date = new Date(m.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
      const senderLabel = normalizeSender(m.sender);
      const chatRef = include_metadata ? ` [[chat:${m.chat_id}|${chatNames[m.chat_id] || m.chat_id}]]` : "";
      return `[${date}] ${senderLabel}${chatRef}: ${m.message_text}`;
    };

    // ── PASSO 4: Decidir estratégia ──
    const totalChars = allMessages.reduce((sum, m) => sum + (m.message_text?.length || 0), 0);
    const approxTokens = Math.ceil(totalChars / 3);
    const SINGLE_PASS_LIMIT = 200_000;

    const model = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash-preview-05-20",
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
      temperature: 0.1,
    });

    const goalsFormatted = analysis_goals.map((g, i) => `OBJETIVO ${i + 1}: ${g}`).join("\n");
    const uniqueChatsCount = new Set(allMessages.map((m) => m.chat_id)).size;

    const ANALYSIS_PROMPT = `Você é uma analista de dados especializada em atendimento médico.

OBJETIVOS DA ANÁLISE:
${goalsFormatted}

REGRAS ABSOLUTAS:
1. Use APENAS os dados fornecidos abaixo. NÃO invente nenhuma informação.
2. Cite mensagens reais como evidência (copie o trecho exato entre aspas).
3. Preserve os links de chat no formato [[chat:ID|Nome]] quando citar.
4. Quantifique tudo: "X de Y conversas mencionaram...", "encontrado em N chats..."
5. Se não encontrar dados suficientes para responder a um objetivo, diga claramente.
6. Organize a análise com seções claras em Markdown, UMA SEÇÃO POR OBJETIVO.
7. Inclua ao final uma seção "📊 Resumo Quantitativo" com os números principais.
8. OBRIGATÓRIO: Ao final, inclua uma seção "🔍 CITAÇÕES PARA VERIFICAÇÃO" com exatamente 5 citações
   no formato: [chat_id]|[trecho exato da mensagem]|[sender]
   Isso será usado para spot-check de integridade.

PERÍODO: ${start_date} a ${end_date}
TOTAL DE MENSAGENS: ${allMessages.length}
TOTAL DE CHATS ÚNICOS: ${uniqueChatsCount}
`;

    let analysisResult: string;
    let method: "single_pass" | "chunked_map_reduce";
    let chunkCount = 0;

    if (approxTokens <= SINGLE_PASS_LIMIT) {
      // ── SINGLE PASS ──
      method = "single_pass";
      const transcript = allMessages.map(formatMessage).join("\n");

      const response = await model.invoke([
        { role: "system", content: ANALYSIS_PROMPT },
        {
          role: "user",
          content: `TRANSCRIÇÃO COMPLETA (${allMessages.length} mensagens):\n\n${transcript}\n\nAnalise conforme os objetivos.`,
        },
      ]);
      analysisResult = typeof response.content === "string" ? response.content : "";
    } else {
      // ── MAP-REDUCE por chat_id ──
      method = "chunked_map_reduce";
      const CHUNK_TOKEN_LIMIT = 150_000;
      const CHARS_PER_CHUNK = CHUNK_TOKEN_LIMIT * 3;

      // Agrupar por chat_id
      const messagesByChat: Record<number, RawChatMessage[]> = {};
      for (const msg of allMessages) {
        if (!messagesByChat[msg.chat_id]) messagesByChat[msg.chat_id] = [];
        messagesByChat[msg.chat_id].push(msg);
      }

      const chunks: RawChatMessage[][] = [];
      let currentChunk: RawChatMessage[] = [];
      let currentChars = 0;

      for (const chatId of Object.keys(messagesByChat).map(Number)) {
        const chatMsgs = messagesByChat[chatId];
        const chatChars = chatMsgs.reduce((sum, m) => sum + (m.message_text?.length || 0) + 80, 0);

        if (currentChars + chatChars > CHARS_PER_CHUNK && currentChunk.length > 0) {
          chunks.push(currentChunk);
          currentChunk = [];
          currentChars = 0;
        }

        currentChunk = currentChunk.concat(chatMsgs);
        currentChars += chatChars;
      }
      if (currentChunk.length > 0) chunks.push(currentChunk);
      chunkCount = chunks.length;

      // MAP
      const chunkResults = await Promise.all(
        chunks.map(async (chunk, i) => {
          const transcript = chunk.map(formatMessage).join("\n");
          const uniqueInChunk = new Set(chunk.map((m) => m.chat_id)).size;
          const response = await model.invoke([
            {
              role: "system",
              content:
                ANALYSIS_PROMPT +
                `\n\nEste é o CHUNK ${i + 1} de ${chunks.length} (${uniqueInChunk} conversas completas). Analise e retorne achados parciais.`,
            },
            {
              role: "user",
              content: `TRANSCRIÇÃO (chunk ${i + 1}/${chunks.length}, ${chunk.length} msgs de ${uniqueInChunk} conversas):\n\n${transcript}`,
            },
          ]);
          return typeof response.content === "string" ? response.content : "";
        })
      );

      // REDUCE
      const reduceResponse = await model.invoke([
        {
          role: "system",
          content: `Você é uma analista consolidando resultados de pesquisa.

OBJETIVOS ORIGINAIS:
${goalsFormatted}

PERÍODO: ${start_date} a ${end_date}
TOTAL ANALISADO: ${allMessages.length} mensagens em ${chunks.length} chunks

REGRAS:
1. Consolide os achados dos chunks em UMA análise coesa
2. Some quantidades, não duplique achados iguais
3. Preserve citações reais e links [[chat:ID|Nome]]
4. Mantenha UMA SEÇÃO POR OBJETIVO original
5. Mantenha a seção "📊 Resumo Quantitativo" com totais consolidados
6. Mantenha a seção "🔍 CITAÇÕES PARA VERIFICAÇÃO" com 5 citações mais representativas
7. NÃO invente dados que não estão nos chunks`,
        },
        {
          role: "user",
          content: `RESULTADOS DOS ${chunks.length} CHUNKS:\n\n${chunkResults
            .map((r, i) => `=== CHUNK ${i + 1} ===\n${r}`)
            .join("\n\n")}\n\nConsolide em uma análise final.`,
        },
      ]);

      analysisResult = typeof reduceResponse.content === "string" ? reduceResponse.content : "";
    }

    // ── PASSO 5: Extrair citações para spot-check ──
    const citationRegex = /\[(\d+)\]\|(.+?)\|(\w+)/g;
    const citations: string[] = [];
    let match;
    while ((match = citationRegex.exec(analysisResult)) !== null) {
      citations.push(JSON.stringify({ chat_id: parseInt(match[1]), text: match[2], sender: match[3] }));
    }

    return `📅 Período: ${start_date} a ${end_date}
📊 Base analisada: ${allMessages.length} mensagens brutas de ${uniqueChatsCount} conversas
⚙️ Método: ${method === "single_pass" ? "Leitura completa (single pass)" : `Map-Reduce por conversa (${chunkCount} chunks)`}
🔍 Tokens processados: ~${approxTokens.toLocaleString()}
🔎 Citações para spot-check: ${citations.length}

---

${analysisResult}

---
__SPOT_CHECK_DATA__: ${JSON.stringify(citations.slice(0, 5))}`;
  },
});
