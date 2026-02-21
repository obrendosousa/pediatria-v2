import { randomUUID } from "node:crypto";
import { END, START, StateGraph, MemorySaver } from "@langchain/langgraph";
import { schedulerRunCommandSchema, workerAckSchema, type SchedulerRunCommandContract, type WorkerAckContract } from "@/lib/automation/contracts";
import { getSupabaseAdminClient } from "@/lib/automation/adapters/supabaseAdmin";
import { getAppointmentsNeedingReminder, getPatientWithRelations, getPatientsReachingMilestone, getReturnsNeedingReminder, hasSentMilestoneAutomation, recordAutomationSent } from "@/utils/automationUtils";
import { replaceVariables } from "@/utils/automationVariables";
import type { AutomationMessage, AutomationRule } from "@/types";
import { logRunEvent } from "@/lib/automation/observability/logger";

interface SchedulerState {
  runId: string;
  dryRun: boolean;
  nowIso: string;
  milestoneRules: AutomationRule[];
  appointmentRule: AutomationRule | null;
  returnRule: AutomationRule | null;
  createdCount: number;
}

async function ensureChatId(phoneRaw: string, contactName?: string): Promise<number | null> {
  const supabase = getSupabaseAdminClient() as any;
  const phone = phoneRaw.replace(/\D/g, "");
  const existing = await supabase.from("chats").select("id").eq("phone", phone).maybeSingle();
  if (existing.error) throw existing.error;
  const existingChat = (existing.data as { id?: number } | null) ?? null;
  if (existingChat?.id) return existingChat.id;

  const created = await supabase
    .from("chats")
    .insert({
      phone,
      contact_name: contactName || "Paciente",
      status: "ACTIVE",
    })
    .select("id")
    .single();

  if (created.error) throw created.error;
  const createdChat = (created.data as { id?: number } | null) ?? null;
  return createdChat?.id || null;
}

async function enqueueSequence(params: {
  runId: string;
  rule: AutomationRule;
  chatId: number;
  titlePrefix: string;
  baseTime: Date;
  sequence: AutomationMessage[];
  variableContext: Record<string, unknown>;
  patientId?: number;
  appointmentId?: number;
  dryRun: boolean;
}) {
  const supabase = getSupabaseAdminClient() as any;
  let delaySeconds = 0;
  let created = 0;

  for (const message of params.sequence) {
    const scheduledFor = new Date(params.baseTime.getTime() + delaySeconds * 1000);
    let content = message.content;
    let caption = message.caption;
    if (message.type === "text") {
      content = replaceVariables(message.content, params.variableContext);
    } else if (message.caption) {
      caption = replaceVariables(message.caption, params.variableContext);
    }

    if (!params.dryRun) {
      const idempotencyKey = `${params.rule.id}:${params.chatId}:${scheduledFor.toISOString()}:${created}`;
      const ins = await supabase.from("scheduled_messages").insert({
        chat_id: params.chatId,
        item_type: "adhoc",
        title: `${params.titlePrefix}: ${params.rule.name}`,
        content: {
          type: message.type,
          content,
          caption,
        },
        scheduled_for: scheduledFor.toISOString(),
        status: "pending",
        automation_rule_id: params.rule.id,
        run_id: params.runId,
        idempotency_key: idempotencyKey,
      });
      if (ins.error) throw ins.error;

      const logIns = await supabase.from("automation_logs").insert({
        automation_rule_id: params.rule.id,
        patient_id: params.patientId,
        appointment_id: params.appointmentId,
        status: "pending",
        run_id: params.runId,
        node_name: "enqueue_sequence",
      });
      if (logIns.error) throw logIns.error;
    }

    created += 1;
    delaySeconds += message.delay || 2;
  }

  return created;
}

let compiledGraphPromise: Promise<ReturnType<StateGraph<SchedulerState>["compile"]>> | null = null;

async function getCompiledSchedulerGraph() {
  if (!compiledGraphPromise) {
    compiledGraphPromise = (async () => {
      // O scheduler nao precisa de checkpoint persistente para gerar filas.
      // MemorySaver evita falhas de cron por indisponibilidade de conexao PG de checkpoint.
      const checkpointer = new MemorySaver();
      const graph = new StateGraph<SchedulerState>({
        channels: {
          runId: { reducer: (_, y) => y, default: () => randomUUID() },
          dryRun: { reducer: (_, y) => y, default: () => false },
          nowIso: { reducer: (_, y) => y, default: () => new Date().toISOString() },
          milestoneRules: { reducer: (_, y) => y, default: () => [] },
          appointmentRule: { reducer: (_, y) => y, default: () => null },
          returnRule: { reducer: (_, y) => y, default: () => null },
          createdCount: { reducer: (_, y) => y, default: () => 0 },
        },
      }) as any;

      graph.addNode("load_rules", async (state: SchedulerState) => {
        const supabase = getSupabaseAdminClient() as any;
        const [milestoneRulesRes, appointmentRuleRes, returnRuleRes] = await Promise.all([
          supabase.from("automation_rules").select("*").eq("type", "milestone").eq("active", true).not("age_months", "is", null),
          supabase.from("automation_rules").select("*").eq("type", "appointment_reminder").eq("active", true).limit(1).maybeSingle(),
          supabase.from("automation_rules").select("*").eq("type", "return_reminder").eq("active", true).limit(1).maybeSingle(),
        ]);

        if (milestoneRulesRes.error) throw milestoneRulesRes.error;
        if (appointmentRuleRes.error) throw appointmentRuleRes.error;
        if (returnRuleRes.error) throw returnRuleRes.error;

        const payload = {
          milestoneRules: (milestoneRulesRes.data || []) as AutomationRule[],
          appointmentRule: (appointmentRuleRes.data as AutomationRule | null) || null,
          returnRule: (returnRuleRes.data as AutomationRule | null) || null,
        };
        await logRunEvent({
          runId: state.runId,
          graphName: "AutomationSchedulerGraph",
          nodeName: "load_rules",
          message: "rules_loaded",
          metadata: {
            milestoneRules: payload.milestoneRules.length,
            hasAppointmentRule: Boolean(payload.appointmentRule),
            hasReturnRule: Boolean(payload.returnRule),
          },
        });
        return payload;
      });

      graph.addNode("evaluate_and_enqueue", async (state: SchedulerState) => {
        let createdCount = 0;
        const now = new Date(state.nowIso);
        const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

        for (const rule of state.milestoneRules) {
          const ruleTime = (rule.trigger_time || "08:00:00").slice(0, 5);
          if (!currentTime.startsWith(ruleTime)) continue;
          const patients = await getPatientsReachingMilestone(rule.age_months || 0);

          for (const patient of patients) {
            const alreadySent = await hasSentMilestoneAutomation(rule.id, patient.id, rule.age_months || 0);
            if (alreadySent) continue;
            if (!patient.phone) continue;
            const chatId = await ensureChatId(patient.phone, patient.name);
            if (!chatId) continue;
            const patientData = await getPatientWithRelations(patient.id);

            createdCount += await enqueueSequence({
              runId: state.runId,
              rule,
              chatId,
              titlePrefix: "Automacao",
              baseTime: now,
              sequence: rule.message_sequence,
              variableContext: { patient: patientData || patient },
              patientId: patient.id,
              dryRun: state.dryRun,
            });
            await logRunEvent({
              runId: state.runId,
              threadId: `chat-${chatId}`,
              graphName: "AutomationSchedulerGraph",
              nodeName: "evaluate_and_enqueue",
              message: "milestone_sequence_enqueued",
              metadata: { ruleId: rule.id, patientId: patient.id },
            });

            if (!state.dryRun) {
              await recordAutomationSent(rule.id, patient.id, rule.age_months || 0);
            }
          }
        }

        if (state.appointmentRule) {
          const rule = state.appointmentRule;
          const appointments = await getAppointmentsNeedingReminder();
          for (const appointment of appointments) {
            if (!appointment.patient_id || !appointment.patient_phone) continue;
            const patient = await getPatientWithRelations(appointment.patient_id);
            if (!patient) continue;
            const chatId = await ensureChatId(appointment.patient_phone, patient.name);
            if (!chatId) continue;

            const triggerAt = new Date(now);
            triggerAt.setDate(triggerAt.getDate() + 1);
            const [h, m] = (rule.trigger_time || "08:00:00").split(":").map(Number);
            triggerAt.setHours(h || 8, m || 0, 0, 0);

            createdCount += await enqueueSequence({
              runId: state.runId,
              rule,
              chatId,
              titlePrefix: "Lembrete",
              baseTime: triggerAt,
              sequence: rule.message_sequence,
              variableContext: { patient, appointment },
              patientId: patient.id,
              appointmentId: appointment.id,
              dryRun: state.dryRun,
            });
            await logRunEvent({
              runId: state.runId,
              threadId: `chat-${chatId}`,
              graphName: "AutomationSchedulerGraph",
              nodeName: "evaluate_and_enqueue",
              message: "appointment_sequence_enqueued",
              metadata: { ruleId: rule.id, patientId: patient.id, appointmentId: appointment.id },
            });
          }
        }

        if (state.returnRule) {
          const rule = state.returnRule;
          const returns = await getReturnsNeedingReminder();
          for (const checkout of returns) {
            if (!checkout.patient_id) continue;
            const patient = await getPatientWithRelations(checkout.patient_id);
            if (!patient || !patient.phone) continue;
            const chatId = await ensureChatId(patient.phone, patient.name);
            if (!chatId) continue;

            const triggerAt = new Date(now);
            triggerAt.setDate(triggerAt.getDate() + 1);
            const [h, m] = (rule.trigger_time || "08:00:00").split(":").map(Number);
            triggerAt.setHours(h || 8, m || 0, 0, 0);

            createdCount += await enqueueSequence({
              runId: state.runId,
              rule,
              chatId,
              titlePrefix: "Retorno",
              baseTime: triggerAt,
              sequence: rule.message_sequence,
              variableContext: { patient, checkout },
              patientId: patient.id,
              dryRun: state.dryRun,
            });
            await logRunEvent({
              runId: state.runId,
              threadId: `chat-${chatId}`,
              graphName: "AutomationSchedulerGraph",
              nodeName: "evaluate_and_enqueue",
              message: "return_sequence_enqueued",
              metadata: { ruleId: rule.id, patientId: patient.id, checkoutId: checkout.id },
            });
          }
        }

        return { createdCount };
      });

      graph.addEdge(START, "load_rules");
      graph.addEdge("load_rules", "evaluate_and_enqueue");
      graph.addEdge("evaluate_and_enqueue", END);
      return graph.compile({ checkpointer });
    })();
  }
  return compiledGraphPromise;
}

export async function runAutomationSchedulerGraph(input: SchedulerRunCommandContract): Promise<WorkerAckContract> {
  const command = schedulerRunCommandSchema.parse(input);
  const runId = command.runId || randomUUID();
  const graph = await getCompiledSchedulerGraph();
  const threadId = `scheduler-${new Date().toISOString().slice(0, 10)}`;
  const state = await graph.invoke(
    {
      runId,
      dryRun: command.dryRun,
      nowIso: command.triggerAt || new Date().toISOString(),
    },
    { configurable: { thread_id: threadId } }
  );

  return workerAckSchema.parse({
    ok: true,
    runId,
    threadId,
    message: "scheduler_graph_executed",
    data: { createdCount: state.createdCount || 0 },
  });
}
