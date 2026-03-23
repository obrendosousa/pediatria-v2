import { END, START, StateGraph, MemorySaver } from "@langchain/langgraph";
const randomUUID = () => crypto.randomUUID();
import { schedulerRunCommandSchema, workerAckSchema, type SchedulerRunCommandContract, type WorkerAckContract } from "@/lib/automation/contracts";
import { getSupabaseAdminClient } from "@/lib/automation/adapters/supabaseAdmin";
import { getAppointmentsNeedingReminder, getPatientWithRelations, getPatientsReachingMilestone, getReturnsNeedingReminder, hasSentMilestoneAutomation, recordAutomationSent } from "@/lib/automation/automationUtilsServer";
import { replaceVariables } from "@/utils/automationVariables";
import type { AutomationMessage, AutomationRule } from "@/types";
import { logRunEvent } from "@/lib/automation/observability/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

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
  const supabase: SupabaseClient = getSupabaseAdminClient();
  const phone = phoneRaw.replace(/\D/g, "");

  // Upsert para evitar race condition: se dois runs paralelos tentarem criar
  // o mesmo chat, o ON CONFLICT garante que apenas um é criado.
  const { data, error } = await supabase
    .from("chats")
    .upsert(
      { phone, contact_name: contactName || "Paciente", status: "ACTIVE" },
      { onConflict: "phone", ignoreDuplicates: true }
    )
    .select("id")
    .single();

  if (error) {
    // Se ignoreDuplicates retornou vazio, buscar o existente
    const existing = await supabase.from("chats").select("id").eq("phone", phone).maybeSingle();
    if (existing.error) throw existing.error;
    return (existing.data as { id?: number } | null)?.id || null;
  }

  return (data as { id?: number } | null)?.id || null;
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
  idempotencyPrefix?: string;
}) {
  const supabase: SupabaseClient = getSupabaseAdminClient();
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
      // Se tiver prefix customizado (appointment/return), usa ele para idempotência estável
      const idempotencyKey = params.idempotencyPrefix
        ? `${params.idempotencyPrefix}:${created}`
        : `${params.rule.id}:${params.chatId}:${scheduledFor.toISOString()}:${created}`;

      // Usa upsert com ON CONFLICT para evitar crash por duplicata
      const ins = await supabase.from("scheduled_messages").upsert(
        {
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
        },
        { onConflict: "idempotency_key", ignoreDuplicates: true }
      );
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let compiledGraphPromise: Promise<ReturnType<StateGraph<SchedulerState>["compile"]>> | null = null;

async function getCompiledSchedulerGraph() {
  if (!compiledGraphPromise) {
    compiledGraphPromise = (async () => {
      const checkpointer = new MemorySaver();
      // LangGraph StateGraph exige cast para lidar com tipagem dinâmica dos channels
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const graph = new StateGraph<SchedulerState>({
        channels: {
          runId: { reducer: (_: string, y: string) => y, default: () => randomUUID() },
          dryRun: { reducer: (_: boolean, y: boolean) => y, default: () => false },
          nowIso: { reducer: (_: string, y: string) => y, default: () => new Date().toISOString() },
          milestoneRules: { reducer: (_: AutomationRule[], y: AutomationRule[]) => y, default: () => [] as AutomationRule[] },
          appointmentRule: { reducer: (_: AutomationRule | null, y: AutomationRule | null) => y, default: () => null as AutomationRule | null },
          returnRule: { reducer: (_: AutomationRule | null, y: AutomationRule | null) => y, default: () => null as AutomationRule | null },
          createdCount: { reducer: (_: number, y: number) => y, default: () => 0 },
        },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      graph.addNode("load_rules", async (state: SchedulerState) => {
        const supabase: SupabaseClient = getSupabaseAdminClient();
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
        // Converter para BRT (America/Sao_Paulo) — trigger_time é armazenado em horário local
        const nowBRT = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
        const currentHH = String(nowBRT.getHours()).padStart(2, "0");
        const currentMM = String(nowBRT.getMinutes()).padStart(2, "0");
        const currentTime = `${currentHH}:${currentMM}`;

        // Milestones: dispara a partir do horário configurado (deduplicado por hasSentMilestoneAutomation)
        for (const rule of state.milestoneRules) {
          const ruleTime = (rule.trigger_time || "08:00:00").slice(0, 5);
          // Dispara se já passou do horário configurado (não exige match exato do minuto)
          if (currentTime < ruleTime) continue;
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

        // Lembretes de consulta: avalia diariamente, envia HOJE (véspera) no horário configurado
        if (state.appointmentRule) {
          const rule = state.appointmentRule;
          const appointments = await getAppointmentsNeedingReminder();
          for (const appointment of appointments) {
            if (!appointment.patient_id || !appointment.patient_phone) continue;
            const patient = await getPatientWithRelations(appointment.patient_id);
            if (!patient) continue;
            const chatId = await ensureChatId(appointment.patient_phone, patient.name);
            if (!chatId) continue;

            // Envia hoje (véspera da consulta), não amanhã (dia da consulta)
            const triggerAt = new Date(now);
            const [h, m] = (rule.trigger_time || "08:00:00").split(":").map(Number);
            triggerAt.setHours(h || 8, m || 0, 0, 0);
            // Se o horário já passou hoje, dispara imediatamente
            if (triggerAt.getTime() < now.getTime()) {
              triggerAt.setTime(now.getTime());
            }

            // Idempotência: usa appointment.id na chave para evitar duplicatas entre runs
            const idempotencyPrefix = `apt-${rule.id}:${appointment.id}`;

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
              idempotencyPrefix,
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

        // Lembretes de retorno: avalia diariamente, envia HOJE (véspera) no horário configurado
        if (state.returnRule) {
          const rule = state.returnRule;
          const returns = await getReturnsNeedingReminder();
          for (const checkout of returns) {
            if (!checkout.patient_id) continue;
            const patient = await getPatientWithRelations(checkout.patient_id);
            if (!patient || !patient.phone) continue;
            const chatId = await ensureChatId(patient.phone, patient.name);
            if (!chatId) continue;

            // Envia hoje (véspera do retorno), não amanhã (dia do retorno)
            const triggerAt = new Date(now);
            const [h, m] = (rule.trigger_time || "08:00:00").split(":").map(Number);
            triggerAt.setHours(h || 8, m || 0, 0, 0);
            // Se o horário já passou hoje, dispara imediatamente
            if (triggerAt.getTime() < now.getTime()) {
              triggerAt.setTime(now.getTime());
            }

            // Idempotência: usa checkout.id na chave para evitar duplicatas entre runs
            const idempotencyPrefix = `ret-${rule.id}:${checkout.id}`;

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
              idempotencyPrefix,
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

      // @ts-expect-error LangGraph tipagem dinâmica de nós
      graph.addEdge(START, "load_rules");
      // @ts-expect-error LangGraph tipagem dinâmica de nós
      graph.addEdge("load_rules", "evaluate_and_enqueue");
      // @ts-expect-error LangGraph tipagem dinâmica de nós
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
