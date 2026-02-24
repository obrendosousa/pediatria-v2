import { StateGraph, START, END } from "@langchain/langgraph";
import { IngestionState, EvolutionWebhookData } from "./state";
import { processInputNode, saveToDbNode, sessionManagerNode } from "./nodes";
import { getAutomationCheckpointer } from "@/lib/automation/checkpointer";

export const ingestionWorkflow = new StateGraph<IngestionState>({
  channels: {
    raw_input: {
      // [FIX] Tipagem explícita dos argumentos para garantir match com a Interface
      reducer: (x: EvolutionWebhookData | undefined, y: EvolutionWebhookData) => y ?? x ?? ({} as EvolutionWebhookData),
      // [FIX] Casting explícito para satisfazer o compilador
      default: () => ({} as EvolutionWebhookData),
    },
    chat_id: {
      reducer: (x: number | undefined, y: number | undefined) => y ?? x,
      default: () => undefined,
    },
    phone: {
      reducer: (x: string | undefined, y: string | undefined) => y ?? x ?? "",
      default: () => "",
    },
    contact_name: {
      reducer: (x: string | undefined, y: string | undefined) => y ?? x ?? "",
      default: () => "",
    },
    message_timestamp_iso: {
      reducer: (x: string | undefined, y: string | undefined) => y ?? x,
      default: () => undefined,
    },
    source_jid: {
      reducer: (x: string | undefined, y: string | undefined) => y ?? x,
      default: () => undefined,
    },
    resolved_jid: {
      reducer: (x: string | undefined, y: string | undefined) => y ?? x,
      default: () => undefined,
    },
    resolver_strategy: {
      reducer: (
        x: IngestionState["resolver_strategy"] | undefined,
        y: IngestionState["resolver_strategy"] | undefined
      ) => y ?? x ?? "direct",
      default: () => "direct" as IngestionState["resolver_strategy"],
    },
    resolver_latency_ms: {
      reducer: (x: number | undefined, y: number | undefined) => y ?? x,
      default: () => undefined,
    },
    resolver_error: {
      reducer: (x: string | undefined, y: string | undefined) => y ?? x,
      default: () => undefined,
    },
    message_content: {
      reducer: (x: string | undefined, y: string | undefined) => y ?? x ?? "",
      default: () => "",
    },
    message_type: {
      // [FIX] Tipagem explícita para o Union Type ('text' | 'audio' | etc.)
      reducer: (
        x: IngestionState["message_type"] | undefined,
        y: IngestionState["message_type"]
      ) => y ?? x ?? "text",
      default: () => "text" as IngestionState["message_type"],
    },
    media_url: {
      reducer: (x: string | undefined, y: string | undefined) => y ?? x,
      default: () => undefined,
    },
    is_ai_paused: {
      reducer: (x: boolean | undefined, y: boolean | undefined) => y ?? x ?? false,
      default: () => false,
    },
    should_continue: {
      reducer: (x: boolean | undefined, y: boolean | undefined) => y ?? x ?? true,
      default: () => true,
    },
  },
});

ingestionWorkflow
  .addNode("processar_entrada", processInputNode)
  .addNode("gerenciar_sessao", sessionManagerNode)
  .addNode("salvar_banco", saveToDbNode)
  .addEdge(START, "processar_entrada")
  .addEdge("processar_entrada", "gerenciar_sessao")
  .addEdge("gerenciar_sessao", "salvar_banco")
  .addEdge("salvar_banco", END);

export const ingestionGraph = ingestionWorkflow.compile();

let persistedGraphPromise: Promise<ReturnType<typeof ingestionWorkflow.compile>> | null = null;

export async function getPersistedIngestionGraph() {
  if (!persistedGraphPromise) {
    persistedGraphPromise = (async () => {
      const checkpointer = await getAutomationCheckpointer();
      return ingestionWorkflow.compile({ checkpointer });
    })();
  }
  return persistedGraphPromise;
}