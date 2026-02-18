import { StateGraph } from "@langchain/langgraph";
import type { DeleteOrchestrationInput, DeleteOrchestrationResult } from "./state";
import { orchestrateDelete } from "./state";

export interface MessageOrchestrationState {
  input: DeleteOrchestrationInput;
  result: DeleteOrchestrationResult | null;
}

const workflow = new StateGraph<MessageOrchestrationState>({
  channels: {
    input: { reducer: (_, y) => y ?? ({} as DeleteOrchestrationInput), default: () => ({} as DeleteOrchestrationInput) },
    result: { reducer: (_, y) => y ?? null, default: () => null },
  },
});

workflow.addNode("orchestrate", (state) => {
  const result = orchestrateDelete(state.input);
  return { result };
});

workflow.setEntryPoint("orchestrate");
workflow.addEdge("orchestrate", "__end__");

export const messageDeleteGraph = workflow.compile();
