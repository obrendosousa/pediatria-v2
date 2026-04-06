import { NextResponse } from "next/server";
import { getTask } from "@/ai/neural-network/task-manager";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get("task_id");

    if (!taskId) {
      return NextResponse.json(
        { error: "task_id query parameter e obrigatorio." },
        { status: 400 }
      );
    }

    const task = await getTask(taskId);

    if (!task) {
      return NextResponse.json(
        { error: `Task '${taskId}' nao encontrada.` },
        { status: 404 }
      );
    }

    return NextResponse.json({ task });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
