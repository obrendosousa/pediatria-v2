/* eslint-disable @typescript-eslint/no-explicit-any */
// Clara v2 Neural Network - CEO Agent Graph (Coordinator)
// 8-node StateGraph: load_context → classify → [simple | plan→dispatch→synthesize→verify→report]
// Based on claurst coordinator.rs + Clara v1 graph.ts patterns

import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { z } from "zod";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { END, START, StateGraph, messagesStateReducer } from "@langchain/langgraph";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

// Clara v1 reusable modules
import { resolveTemporalAnchor, type TemporalAnchor } from "@/ai/clara/temporal_anchor";
import { getDbStats, type DbStats } from "@/ai/clara/db_stats";
import { loadContextForInteraction, type LoadedContext } from "@/ai/clara/load_context";
import { setCurrentTemporalAnchor } from "@/ai/clara/tools";
import { postgresCheckpointer } from "@/ai/clara/checkpointer";
import { getSupabaseAdminClient } from "@/lib/automation/adapters/supabaseAdmin";

// Phase 1+2 neural network modules
import type { AgentId } from "./types";
import { AGENT_DEFINITIONS } from "./types";
import { dispatchParallel, type DispatchParams } from "./worker-executor";
// Aggregation functions available for synthesize node when structured outputs are used
// import { aggregateFinancials, aggregateClassifications, mergeReports } from "./output-schemas";
import { getCeoSimpleTools } from "./ceo-tools";
import { buildCeoSimplePrompt, buildCeoPlannerPrompt, buildCeoReportPrompt } from "./ceo-prompts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CEO_CHAT_ID = 1495; // Clara's internal chat for context loading
const MAX_SIMPLE_TOOL_ITERATIONS = 10;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface CeoState {
  messages: BaseMessage[];
  current_user_role: string;

  // Context (load_context node)
  temporal_anchor: TemporalAnchor | null;
  db_stats: DbStats | null;
  loaded_context: LoadedContext | null;

  // Classification
  classification: "simple" | "single_sector" | "cross_sector";

  // Task planning & dispatch
  planned_tasks: Array<{ agent_id: string; description: string }>;
  worker_results: Record<string, Record<string, unknown> | null>;
  failed_agents: string[];

  // Synthesis
  aggregated_data: Record<string, unknown> | null;
  verification_needed: boolean;

  // Verification
  verification_result: Record<string, unknown> | null;

  // Control
  tool_call_count: number;
  iteration: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractUserText(messages: BaseMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]._getType() === "human") {
      const content = messages[i].content;
      return typeof content === "string" ? content : JSON.stringify(content);
    }
  }
  return "";
}

async function loadBrainFiles(): Promise<{ company: string; rules: string }> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data } = await supabase
      .from("agent_config")
      .select("config_key, content")
      .eq("agent_id", "clara")
      .in("config_key", ["company", "rules"]);

    const map = Object.fromEntries(
      ((data ?? []) as Array<{ config_key: string; content: string }>).map(r => [r.config_key, r.content])
    );
    return { company: map.company ?? "", rules: map.rules ?? "" };
  } catch {
    return { company: "", rules: "" };
  }
}

// ---------------------------------------------------------------------------
// NODE 1: Load Context (reuses Clara v1 modules)
// ---------------------------------------------------------------------------

async function loadContextNode(state: CeoState): Promise<Partial<CeoState>> {
  const userText = extractUserText(state.messages);

  // resolveTemporalAnchor is synchronous, others are async
  let temporalAnchor: TemporalAnchor | null = null;
  try {
    temporalAnchor = resolveTemporalAnchor(userText, null);
  } catch { /* fallback to null */ }

  const [dbStats, loadedContext] = await Promise.all([
    getDbStats().catch(() => null),
    loadContextForInteraction(userText, CEO_CHAT_ID).catch(() => null),
  ]);

  if (temporalAnchor) setCurrentTemporalAnchor(temporalAnchor);

  return {
    temporal_anchor: temporalAnchor,
    db_stats: dbStats,
    loaded_context: loadedContext,
  };
}

// ---------------------------------------------------------------------------
// NODE 2: Classify (simple vs single_sector vs cross_sector)
// ---------------------------------------------------------------------------

const ClassifySchema = z.object({
  classification: z.enum(["simple", "single_sector", "cross_sector"]),
  reasoning: z.string(),
});

async function classifyNode(state: CeoState): Promise<Partial<CeoState>> {
  const userText = extractUserText(state.messages);

  const model = new ChatGoogleGenerativeAI({
    model: "gemini-3-flash-preview",
    temperature: 0,
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
  });

  const response = await model.invoke([
    new SystemMessage(`Classifique a pergunta do CEO da clinica:

- "simple": pergunta direta sobre metricas, lookup, ou consulta de 1 dado. Ex: "receita de hoje?", "quantos chats?", "regras da clinica"
- "single_sector": analise complexa de 1 setor. Ex: "analise detalhada de objecoes", "relatorio financeiro completo"
- "cross_sector": precisa cruzar dados de 2+ setores. Ex: "por que a margem caiu?", "como otimizar a clinica?", "compare receita com conversao"

Default para "simple" na duvida. Responda APENAS com JSON: {"classification":"...","reasoning":"..."}`),
    new HumanMessage(userText),
  ]);

  try {
    const content = typeof response.content === "string" ? response.content : JSON.stringify(response.content);
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = ClassifySchema.parse(JSON.parse(jsonMatch[0]));
      return { classification: parsed.classification };
    }
  } catch {
    // fallback
  }
  return { classification: "simple" };
}

// ---------------------------------------------------------------------------
// NODE 3a: Simple Answer (CEO answers directly with tools)
// ---------------------------------------------------------------------------

const ceoTools = getCeoSimpleTools();
const toolNode = new ToolNode(ceoTools);

async function simpleAnswerNode(state: CeoState): Promise<Partial<CeoState>> {
  const context = {
    temporalAnchor: state.temporal_anchor,
    dbStats: state.db_stats,
    loadedContext: state.loaded_context,
  };
  const brainFiles = await loadBrainFiles();

  const systemPrompt = buildCeoSimplePrompt({ ...context, brainFiles: undefined });
  // Append brain files to system prompt
  const fullPrompt = `${systemPrompt}\n\n## EMPRESA\n${brainFiles.company}\n\n## REGRAS\n${brainFiles.rules}`;

  const model = new ChatGoogleGenerativeAI({
    model: "gemini-3-flash-preview",
    temperature: 0,
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
  }).bindTools(ceoTools);

  const response = await model.invoke([
    new SystemMessage(fullPrompt),
    ...state.messages,
  ]);

  return {
    messages: [response],
    tool_call_count: (state.tool_call_count ?? 0) + 1,
  };
}

// ---------------------------------------------------------------------------
// NODE 4: Plan Tasks (decide which workers to dispatch)
// ---------------------------------------------------------------------------

const VALID_WORKER_IDS = [
  'financeiro_agent', 'recepcao_agent', 'comercial_agent',
  'pediatria_agent', 'clinica_geral_agent', 'estoque_agent', 'rh_ops_agent',
] as const;

const PlanSchema = z.object({
  agents: z.array(z.object({
    agent_id: z.enum(VALID_WORKER_IDS),
    task_description: z.string(),
  })),
});

async function planTasksNode(state: CeoState): Promise<Partial<CeoState>> {
  const userText = extractUserText(state.messages);
  const context = {
    temporalAnchor: state.temporal_anchor,
    dbStats: state.db_stats,
    loadedContext: state.loaded_context,
    availableWorkers: Object.entries(AGENT_DEFINITIONS)
      .filter(([, def]) => def.role === "worker")
      .map(([id, def]) => `${id} — ${def.description}`),
  };

  const prompt = buildCeoPlannerPrompt(context);

  const model = new ChatGoogleGenerativeAI({
    model: "gemini-3-flash-preview",
    temperature: 0,
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
  });

  // Include temporal context in task descriptions
  const temporalContext = state.temporal_anchor
    ? `Periodo: ${state.temporal_anchor.period_label} (${state.temporal_anchor.start_brt} a ${state.temporal_anchor.end_brt})`
    : "Periodo: ultimos 7 dias";

  const response = await model.invoke([
    new SystemMessage(prompt),
    new HumanMessage(`Pergunta do CEO: "${userText}"\n\n${temporalContext}\n\nResponda APENAS com JSON: {"agents":[{"agent_id":"...","task_description":"..."}]}`),
  ]);

  try {
    const content = typeof response.content === "string" ? response.content : JSON.stringify(response.content);
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = PlanSchema.parse(JSON.parse(jsonMatch[0]));
      return {
        planned_tasks: parsed.agents.map(a => ({
          agent_id: a.agent_id,
          description: a.task_description,
        })),
      };
    }
  } catch {
    // fallback: dispatch financeiro_agent with original question
  }

  return {
    planned_tasks: [{
      agent_id: "financeiro_agent",
      description: userText,
    }],
  };
}

// ---------------------------------------------------------------------------
// NODE 5: Dispatch Workers (parallel execution)
// ---------------------------------------------------------------------------

async function dispatchWorkersNode(state: CeoState): Promise<Partial<CeoState>> {
  const workerParams: DispatchParams[] = state.planned_tasks.map(task => ({
    agentId: task.agent_id as AgentId,
    description: task.description,
    context: {
      temporalAnchor: state.temporal_anchor,
      dbStats: state.db_stats,
    },
  }));

  const { tasks, results, failed } = await dispatchParallel(workerParams);

  // Map results by agent_id (not by index — order is NOT guaranteed)
  const workerResults: Record<string, Record<string, unknown> | null> = {};
  const failedAgents: string[] = [];

  for (const task of tasks) {
    const result = results.get(task.id);
    if (result !== undefined) {
      workerResults[task.agent_id] = result;
    }
    if (task.status === 'failed' || failed.includes(task.id)) {
      failedAgents.push(task.agent_id);
    }
  }

  return { worker_results: workerResults, failed_agents: failedAgents };
}

// ---------------------------------------------------------------------------
// NODE 6: Synthesize (programmatic aggregation, NO LLM)
// ---------------------------------------------------------------------------

async function synthesizeNode(state: CeoState): Promise<Partial<CeoState>> {
  const aggregated: Record<string, unknown> = {};
  let verificationNeeded = false;

  // Collect all worker outputs, marking which have real data vs raw text
  let workersWithData = 0;

  for (const [agentId, result] of Object.entries(state.worker_results)) {
    if (!result) continue;

    const raw = (result as Record<string, unknown>).raw_response;
    const hasStructuredData = result && !raw && Object.keys(result).length > 0;
    const hasTextData = typeof raw === 'string' && raw.length > 50;

    if (hasStructuredData || hasTextData) {
      aggregated[agentId] = result;
      workersWithData++;
    }
  }

  // Add failure info
  if (state.failed_agents.length > 0) {
    aggregated["_failures"] = {
      agents: state.failed_agents,
      message: `Workers indisponiveis: ${state.failed_agents.join(", ")}`,
    };
  }

  // Only verify if 2+ workers returned data (worth cross-checking)
  verificationNeeded = workersWithData >= 2;

  return {
    aggregated_data: aggregated,
    verification_needed: verificationNeeded && state.failed_agents.length === 0,
  };
}

// ---------------------------------------------------------------------------
// NODE 7: Verify (spot-check critical numbers)
// ---------------------------------------------------------------------------

async function verifyNode(state: CeoState): Promise<Partial<CeoState>> {
  // Simple verification: re-query a KPI to cross-check worker data
  // Uses Flash (cheap + fast) to verify critical claims
  try {
    const model = new ChatGoogleGenerativeAI({
      model: "gemini-3-flash-preview",
      temperature: 0,
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    });

    const workerSummary = JSON.stringify(state.aggregated_data, null, 2).slice(0, 5000);

    const response = await model.invoke([
      new SystemMessage(`Voce e um verificador. Analise os dados dos workers abaixo e identifique:
1. Numeros que parecem inconsistentes ou contraditorios entre workers
2. Dados que precisariam de verificacao cruzada
Responda JSON: {"issues":["..."],"confidence":"high"|"medium"|"low"}`),
      new HumanMessage(workerSummary),
    ]);

    const content = typeof response.content === "string" ? response.content : "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return { verification_result: JSON.parse(jsonMatch[0]) };
    }
  } catch {
    // Verification failed, proceed anyway
  }

  return { verification_result: { issues: [], confidence: "medium" } };
}

// ---------------------------------------------------------------------------
// NODE 8: Final Report (LLM generates narrative from aggregated data)
// ---------------------------------------------------------------------------

async function finalReportNode(state: CeoState): Promise<Partial<CeoState>> {
  const context = {
    temporalAnchor: state.temporal_anchor,
    dbStats: state.db_stats,
    loadedContext: state.loaded_context,
  };

  const prompt = buildCeoReportPrompt(state.aggregated_data ?? {}, context);

  const model = new ChatGoogleGenerativeAI({
    model: "gemini-3-flash-preview",
    temperature: 0.3,
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
  });

  const userQuestion = extractUserText(state.messages);

  const verificationNote = state.verification_result
    ? `\n\nVerificacao: ${JSON.stringify(state.verification_result)}`
    : "";

  const failureNote = state.failed_agents.length > 0
    ? `\n\nATENCAO: Estes workers falharam e seus dados NAO estao disponiveis: ${state.failed_agents.join(", ")}. Mencione isso na resposta.`
    : "";

  const response = await model.invoke([
    new SystemMessage(prompt + verificationNote + failureNote),
    new HumanMessage(`Pergunta original do CEO: "${userQuestion}"\n\nGere a resposta final.`),
  ]);

  return { messages: [new AIMessage(typeof response.content === "string" ? response.content : JSON.stringify(response.content))] };
}

// ---------------------------------------------------------------------------
// Graph Assembly
// ---------------------------------------------------------------------------

const ceoWorkflow = new StateGraph({
  channels: {
    messages: { reducer: messagesStateReducer, default: () => [] },
    current_user_role: { default: () => "admin" },
    temporal_anchor: { default: () => null },
    db_stats: { default: () => null },
    loaded_context: { default: () => null },
    classification: { default: () => "simple" },
    planned_tasks: { default: () => [] },
    worker_results: { default: () => ({}) },
    failed_agents: { default: () => [] },
    aggregated_data: { default: () => null },
    verification_needed: { default: () => false },
    verification_result: { default: () => null },
    tool_call_count: { default: () => 0 },
    iteration: { default: () => 0 },
  },
})
  // Nodes
  .addNode("load_context", loadContextNode)
  .addNode("classify", classifyNode)
  .addNode("simple_answer", simpleAnswerNode)
  .addNode("tools", toolNode)
  .addNode("plan_tasks", planTasksNode)
  .addNode("dispatch_workers", dispatchWorkersNode)
  .addNode("synthesize", synthesizeNode)
  .addNode("verify", verifyNode)
  .addNode("final_report", finalReportNode)

  // Edges
  .addEdge(START, "load_context")
  .addEdge("load_context", "classify")

  // Classify → simple or plan
  .addConditionalEdges("classify", (state: CeoState) => {
    if (state.classification === "simple") return "simple_answer";
    return "plan_tasks";
  })

  // Simple answer loop (tools → simple_answer, like Clara v1)
  .addConditionalEdges("simple_answer", (state: CeoState) => {
    if ((state.tool_call_count ?? 0) >= MAX_SIMPLE_TOOL_ITERATIONS) return END;
    return toolsCondition(state);
  }, {
    tools: "tools",
    __end__: END,
  })
  .addEdge("tools", "simple_answer")

  // Dispatch flow
  .addEdge("plan_tasks", "dispatch_workers")
  .addEdge("dispatch_workers", "synthesize")

  // Synthesize → verify or report
  .addConditionalEdges("synthesize", (state: CeoState) => {
    if (state.verification_needed) return "verify";
    return "final_report";
  })
  .addEdge("verify", "final_report")
  .addEdge("final_report", END);

// ---------------------------------------------------------------------------
// Compiled Graph
// ---------------------------------------------------------------------------

export const ceoGraph = ceoWorkflow.compile({
  checkpointer: postgresCheckpointer,
  recursionLimit: 75,
});
