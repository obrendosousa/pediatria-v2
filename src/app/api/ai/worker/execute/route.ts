/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { dispatchAndWait } from "@/ai/neural-network/worker-executor";
import { AGENT_DEFINITIONS } from "@/ai/neural-network/types";
import type { AgentId } from "@/ai/neural-network/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { agent_id, description, input_params, output_schema } = body;

    if (!agent_id || !description) {
      return NextResponse.json(
        { error: "agent_id e description sao obrigatorios." },
        { status: 400 }
      );
    }

    if (!AGENT_DEFINITIONS[agent_id as AgentId]) {
      return NextResponse.json(
        { error: `Agent '${agent_id}' nao encontrado.`, valid_agents: Object.keys(AGENT_DEFINITIONS) },
        { status: 400 }
      );
    }

    const definition = AGENT_DEFINITIONS[agent_id as AgentId];
    if (definition.role !== 'worker') {
      return NextResponse.json(
        { error: `Agent '${agent_id}' e um coordinator, nao um worker. Use a rota do CEO Agent.` },
        { status: 400 }
      );
    }

    const { task, result } = await dispatchAndWait({
      agentId: agent_id as AgentId,
      description,
      inputParams: input_params,
      outputSchema: output_schema,
    });

    return NextResponse.json({
      task_id: task.id,
      agent_id: task.agent_id,
      status: task.status,
      result,
      metrics: {
        execution_time_ms: task.execution_time_ms,
        model_used: task.model_used,
        token_usage: task.token_usage,
        retry_count: task.retry_count,
      },
      error: task.error_message,
    });

  } catch (error: any) {
    console.error("[worker/execute] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
