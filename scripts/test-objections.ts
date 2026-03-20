import "dotenv/config";
import { HumanMessage } from "@langchain/core/messages";
import { claraGraph } from "../src/ai/clara/graph";

interface LCMsg {
  _getType?: () => string;
  constructor?: { name?: string };
  content: string | Array<{ text?: string } | string>;
}

function extract(msgs: LCMsg[]): string {
  return msgs
    .filter((m) => m._getType?.() === "ai" || m.constructor?.name === "AIMessage")
    .map((m) => {
      if (typeof m.content === "string") return m.content;
      if (Array.isArray(m.content))
        return m.content.map((p) => (typeof p === "string" ? p : p?.text || "")).join("");
      return "";
    })
    .join("\n");
}

async function main() {
  const question = `[MODO COPILOTO — CONSULTA GLOBAL]
Você é a Clara, assistente de IA da clínica. O usuário fez uma pergunta GLOBAL sobre a clínica.

PERGUNTA DO USUÁRIO: Analise TODAS as conversas de março (01/03 a 20/03) e classifique cada uma delas individualmente. Quero o funil REAL: quantas entraram, quantas agendaram consulta, quantas perdemos por preço, por falta de vaga, por logística, quantas foram só informativas, e quantas ficaram sem resposta. Me dê os números exatos com os chat_ids de cada categoria.

INSTRUÇÕES: Use suas ferramentas para buscar dados de TODO o banco. Não limite a um paciente específico. Use per_chat_classification=true para análise individual de cada conversa.`;

  const t0 = Date.now();
  process.stdout.write("Iniciando fan-out analysis...\n");

  const result = await claraGraph.invoke(
    {
      messages: [new HumanMessage(question)],
      chat_id: 1495,
      is_deep_research: false, is_planning_mode: false,
      research_brief: "", raw_notes: [], supervisor_messages: [],
      supervisor_iteration: 0, research_complete: false,
      current_user_role: "admin" as const,
      db_stats: null, loaded_context: null, spot_check_result: null, pending_question: null,
    },
    { configurable: { thread_id: `fanout-${Date.now()}` }, recursionLimit: 50 },
  );

  const text = extract(Array.isArray(result.messages) ? result.messages : []);
  const sec = ((Date.now() - t0) / 1000).toFixed(1);

  process.stdout.write(`\n${"═".repeat(60)}\nTempo total: ${sec}s\n${"═".repeat(60)}\n\n`);
  process.stdout.write(text + "\n");
  process.exit(0);
}

main().catch((e) => { process.stderr.write(String(e) + "\n"); process.exit(1); });
