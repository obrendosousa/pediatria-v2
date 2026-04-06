// Clara v2 Neural Network - Worker Graph Factory
// Creates reusable LangGraph StateGraphs for sector-specific workers
// All workers follow the same pattern: execute → tools → format_output

import {
  BaseMessage,
  SystemMessage,
  HumanMessage,
} from "@langchain/core/messages";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — @langchain/langgraph ships without declaration files
import { END, START, StateGraph, messagesStateReducer } from "@langchain/langgraph";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — @langchain/langgraph/prebuilt ships without declaration files
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import type { DynamicStructuredTool } from "@langchain/core/tools";

import type { AgentId, ClaraTask } from "./types";
import { AGENT_DEFINITIONS, MAX_WORKER_ITERATIONS } from "./types";
import { selectModel } from "./model-selector";

// ---------------------------------------------------------------------------
// Worker State
// ---------------------------------------------------------------------------

export interface WorkerState {
  messages: BaseMessage[];
  task: ClaraTask;
  agent_id: AgentId;
  iteration: number;
  result: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface WorkerGraphConfig {
  agentId: AgentId;
  tools: DynamicStructuredTool[];
  model?: string;
  temperature?: number;
  maxIterations?: number;
  systemPromptBuilder?: (task: ClaraTask) => string;
}

// ---------------------------------------------------------------------------
// Default System Prompt Builder
// ---------------------------------------------------------------------------

function defaultWorkerSystemPrompt(agentId: AgentId, task: ClaraTask): string {
  const definition = AGENT_DEFINITIONS[agentId];

  return `Voce e o ${definition.name}, um agente de IA especializado da Clinica Alianca.

## Sua Funcao
${definition.description}

## Tarefa Atual
${task.description}

## Tabelas que Voce Pode Consultar
${definition.schema_access.join(', ')}

## Regras
- Responda APENAS com dados reais extraidos das ferramentas. NUNCA invente dados.
- Cite sempre a fonte (tabela, query, chat_id).
- Use formato estruturado (JSON) quando o output_schema estiver definido.
- Respeite LGPD: sem PII (nomes de pacientes, telefones, CPF) em relatorios.
- Se nao encontrar dados suficientes, retorne o que tem com uma nota sobre dados faltantes.
- Fuso horario: America/Sao_Paulo (BRT, UTC-3).

## Output Esperado
${task.output_schema
    ? `Retorne JSON seguindo o schema: ${task.output_schema}`
    : 'Retorne um JSON estruturado com os dados solicitados.'}`;
}

// ---------------------------------------------------------------------------
// Graph Factory
// ---------------------------------------------------------------------------

export function createWorkerGraph(config: WorkerGraphConfig) {
  const {
    agentId,
    tools,
    maxIterations = MAX_WORKER_ITERATIONS,
    systemPromptBuilder,
  } = config;

  const toolNode = new ToolNode(tools);

  // Define the state graph
  const workflow = new StateGraph({
    channels: {
      messages: { reducer: messagesStateReducer, default: () => [] },
      task: { default: () => ({}) },
      agent_id: { default: () => agentId },
      iteration: { default: () => 0 },
      result: { default: () => null },
    },
  })
    // ----- EXECUTE NODE -----
    .addNode("execute", async (state: WorkerState) => {
      const modelConfig = selectModel(agentId, state.task?.description);

      const llm = new ChatGoogleGenerativeAI({
        model: config.model ?? modelConfig.model,
        temperature: config.temperature ?? modelConfig.temperature,
        maxOutputTokens: modelConfig.maxOutputTokens,
        apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
      }).bindTools(tools);

      // Build system prompt on first iteration, persist it in messages for subsequent iterations
      const isFirstIteration = state.iteration === 0;
      const hasSystemPrompt = state.messages.length > 0 && state.messages[0]._getType?.() === 'system';

      let messagesToSend: BaseMessage[];

      if (isFirstIteration && !hasSystemPrompt) {
        const systemPrompt = (systemPromptBuilder ?? ((t: ClaraTask) => defaultWorkerSystemPrompt(agentId, t)))(state.task);
        messagesToSend = [new SystemMessage(systemPrompt), ...state.messages];
      } else {
        messagesToSend = state.messages;
      }

      const response = await llm.invoke(messagesToSend);

      // On first iteration, include SystemMessage in state so it persists across tool-call loops
      const newMessages = (isFirstIteration && !hasSystemPrompt)
        ? [messagesToSend[0], response]  // SystemMessage + AI response
        : [response];

      return {
        messages: newMessages,
        iteration: state.iteration + 1,
      };
    })

    // ----- TOOLS NODE -----
    .addNode("tools", toolNode)

    // ----- FORMAT OUTPUT NODE -----
    .addNode("format_output", async (state: WorkerState) => {
      // Walk backwards through messages to find the last AI message with TEXT content
      // (skip tool calls, tool results, and empty messages)
      let content = '';
      for (let i = state.messages.length - 1; i >= 0; i--) {
        const msg = state.messages[i];
        const msgType = (msg as { _getType?: () => string })._getType?.() ?? '';
        if (msgType !== 'ai') continue;

        const raw = msg.content;
        if (typeof raw === 'string' && raw.trim().length > 0) {
          content = raw;
          break;
        }
        // LangChain sometimes returns content as array of blocks
        if (Array.isArray(raw)) {
          const textParts = (raw as Array<{ type?: string; text?: string }>)
            .filter(b => b.type === 'text' && b.text)
            .map(b => b.text!)
            .join('');
          if (textParts.length > 0) {
            content = textParts;
            break;
          }
        }
      }

      if (!content) {
        content = 'Worker nao gerou resposta textual.';
      }

      // Try to parse as JSON
      let parsed: Record<string, unknown> | null = null;
      try {
        parsed = JSON.parse(content);
      } catch {
        // If not valid JSON, wrap in a generic result
        parsed = { raw_response: content };
      }

      return { result: parsed };
    })

    // ----- EDGES -----
    .addEdge(START, "execute")
    .addConditionalEdges("execute", (state: WorkerState) => {
      // Safety: max iterations reached → format output
      if (state.iteration >= maxIterations) return "format_output";

      // If model made tool calls → execute them
      return toolsCondition(state);
    }, {
      tools: "tools",
      format_output: "format_output",
      [END]: "format_output",
      __end__: "format_output",
    })
    .addEdge("tools", "execute")
    .addEdge("format_output", END);

  return workflow.compile();
}

// ---------------------------------------------------------------------------
// Convenience: Execute a worker for a task
// ---------------------------------------------------------------------------

export async function executeWorkerForTask(
  config: WorkerGraphConfig,
  task: ClaraTask
): Promise<{ result: Record<string, unknown> | null; messages: BaseMessage[] }> {
  const graph = createWorkerGraph(config);

  const initialState: Partial<WorkerState> = {
    messages: [new HumanMessage(task.description)],
    task,
    agent_id: config.agentId,
    iteration: 0,
    result: null,
  };

  const finalState = await graph.invoke(initialState);

  return {
    result: finalState.result ?? null,
    messages: finalState.messages ?? [],
  };
}
