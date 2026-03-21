/**
 * Clara Task Executor — Executa tarefas agendadas pela Clara.
 *
 * Roda a cada 30s no RobustCronManager. Busca tasks com status='pending'
 * e run_at <= now(), executa via claraGraph.invoke, e atualiza o resultado.
 *
 * Guardrails:
 * - Max 3 tasks por ciclo (evitar sobrecarga)
 * - Tasks expiradas sao marcadas automaticamente
 * - Tasks recorrentes (monitor) sao re-agendadas apos execucao
 * - Instrucoes prefixadas com [TAREFA AGENDADA] para Clara saber o contexto
 * - Instrucoes incluem "NAO crie novas tarefas" para evitar loops
 */

import { createClient } from "@supabase/supabase-js";
import { claraGraph } from "@/ai/clara/graph";
import { HumanMessage } from "@langchain/core/messages";
import { syncScheduledTaskToVault } from "@/ai/vault/sync";

const MAX_TASKS_PER_CYCLE = 3;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

function getTaskSupabase(): AnySupabase {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars nao configuradas");
  return createClient(url, key, { auth: { persistSession: false } });
}

interface ScheduledTask {
  id: number;
  task_type: string;
  title: string;
  description: string | null;
  instruction: string;
  run_at: string;
  repeat_interval_minutes: number | null;
  max_repeats: number;
  execution_count: number;
  priority: string;
  context: Record<string, unknown>;
}

async function getClaraChatId(supabase: AnySupabase): Promise<number | null> {
  const { data } = await supabase.from("chats").select("id").eq("phone", "00000000000").single();
  return (data as { id: number } | null)?.id ?? null;
}

async function expireOldTasks(supabase: AnySupabase): Promise<number> {
  const { data } = await supabase.from("clara_scheduled_tasks").update({ status: "expired" }).eq("status", "pending").lte("expires_at", new Date().toISOString()).select("id");
  return (data as Array<{ id: number }> | null)?.length ?? 0;
}

async function claimPendingTasks(supabase: AnySupabase): Promise<ScheduledTask[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("clara_scheduled_tasks").select("id, task_type, title, description, instruction, run_at, repeat_interval_minutes, max_repeats, execution_count, priority, context").eq("status", "pending").lte("run_at", now).order("priority", { ascending: false }).order("run_at", { ascending: true }).limit(MAX_TASKS_PER_CYCLE);

  if (error) {
    console.error("[Clara Task Executor] Erro ao buscar tasks:", error.message);
    return [];
  }
  return (data as ScheduledTask[] | null) ?? [];
}

async function executeTask(
  supabase: AnySupabase,
  task: ScheduledTask,
  claraChatId: number
): Promise<void> {
  const taskLabel = `#${task.id} "${task.title}"`;

  // Marcar como running
  await supabase.from("clara_scheduled_tasks").update({ status: "running" }).eq("id", task.id);

  try {
    const contextInfo = task.context && Object.keys(task.context).length > 0
      ? `\nContexto adicional: ${JSON.stringify(task.context)}`
      : "";

    const instruction = `[TAREFA AGENDADA #${task.id} — ${task.task_type.toUpperCase()}]
${task.instruction}${contextInfo}

IMPORTANTE: Esta e uma tarefa agendada automaticamente. Responda de forma concisa com o resultado.
NAO crie novas tarefas agendadas nesta execucao.`;

    console.log(`[Clara Task Executor] Executando task ${taskLabel}...`);

    const result = await claraGraph.invoke(
      {
        messages: [new HumanMessage(instruction)],
        chat_id: claraChatId,
      },
      { configurable: { thread_id: `clara_task_${task.id}_${Date.now()}` } }
    );

    const messages = (result as { messages: Array<{ content: unknown }> }).messages;
    const lastMessage = messages[messages.length - 1];
    const responseText = typeof lastMessage.content === "string"
      ? lastMessage.content
      : String(lastMessage.content);

    const newExecutionCount = task.execution_count + 1;
    const repeatMinutes = task.repeat_interval_minutes ?? 0;
    const isRecurring = repeatMinutes > 0;
    const hasMoreRepeats = newExecutionCount < task.max_repeats;

    if (isRecurring && hasMoreRepeats) {
      const nextRunAt = new Date(Date.now() + repeatMinutes * 60_000).toISOString();
      await supabase.from("clara_scheduled_tasks").update({ status: "pending", run_at: nextRunAt, execution_count: newExecutionCount, executed_at: new Date().toISOString(), result: responseText.slice(0, 2000) }).eq("id", task.id);
      console.log(`[Clara Task Executor] Task ${taskLabel} concluida (${newExecutionCount}/${task.max_repeats}). Proxima em ${repeatMinutes}min.`);
    } else {
      await supabase.from("clara_scheduled_tasks").update({ status: "completed", execution_count: newExecutionCount, executed_at: new Date().toISOString(), result: responseText.slice(0, 2000) }).eq("id", task.id);
      console.log(`[Clara Task Executor] Task ${taskLabel} concluida.`);
    }

    // Postar resultado no chat da Clara
    await supabase.from("chat_messages").insert({ chat_id: claraChatId, phone: "00000000000", sender: "contact", message_text: `Tarefa Agendada #${task.id} (${task.task_type}): "${task.title}"\n\n${responseText}`, message_type: "text", status: "read", created_at: new Date().toISOString(), wpp_id: `task_${task.id}_${Date.now()}` });

    // Vault sync (fire-and-forget)
    syncScheduledTaskToVault(
      task.id, task.title, task.task_type, task.instruction,
      task.run_at, "completed", responseText.slice(0, 500)
    ).catch(() => {});

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Clara Task Executor] Erro na task ${taskLabel}:`, errorMsg);
    await supabase.from("clara_scheduled_tasks").update({ status: "failed", executed_at: new Date().toISOString(), error: errorMsg.slice(0, 500) }).eq("id", task.id);
  }
}

/**
 * Task principal — chamada pelo RobustCronManager a cada 30s.
 */
export async function claraTaskExecutorTask(): Promise<void> {
  const supabase = getTaskSupabase();

  // 1. Expirar tasks vencidas
  const expired = await expireOldTasks(supabase);
  if (expired > 0) {
    console.log(`[Clara Task Executor] ${expired} task(s) expirada(s).`);
  }

  // 2. Buscar tasks prontas
  const tasks = await claimPendingTasks(supabase);
  if (tasks.length === 0) return;

  // 3. Buscar chat da Clara
  const claraChatId = await getClaraChatId(supabase);
  if (!claraChatId) {
    console.error("[Clara Task Executor] Chat da Clara nao encontrado (phone='00000000000').");
    return;
  }

  // 4. Executar tasks sequencialmente
  for (const task of tasks) {
    await executeTask(supabase, task, claraChatId);
  }
}
