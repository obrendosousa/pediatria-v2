/**
 * Vault Cron Jobs — Consolidacao automatica do conhecimento.
 *
 * Estrategia: cada job roda a cada 60s no RobustCronManager, mas internamente
 * checa o horario BRT e um flag "ja rodou hoje/semana/mes" para so executar
 * na hora certa. Isso evita crontab externo e aproveita o worker existente.
 *
 * - Daily:   23:00-23:59 BRT, 1x por dia
 * - Weekly:  Domingo 23:00-23:59 BRT, 1x por semana
 * - Monthly: Ultimo dia do mes 23:00-23:59 BRT, 1x por mes
 */

import {
  runDailyConsolidation,
  runWeeklyConsolidation,
  runMonthlyConsolidation,
} from "@/ai/vault/consolidation";
import { isVaultAvailable } from "@/ai/vault/service";

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/** Retorna data/hora atual em BRT */
function nowBRT(): { date: string; hour: number; dayOfWeek: number; isLastDayOfMonth: boolean } {
  const now = new Date();
  const brt = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));

  const year = brt.getFullYear();
  const month = brt.getMonth();
  const day = brt.getDate();
  const hour = brt.getHours();
  const dayOfWeek = brt.getDay(); // 0 = domingo

  // Checar se e o ultimo dia do mes
  const lastDay = new Date(year, month + 1, 0).getDate();
  const isLastDayOfMonth = day === lastDay;

  const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  return { date: dateStr, hour, dayOfWeek, isLastDayOfMonth };
}

// ═══════════════════════════════════════════════════════════════════════════
// STATE — Flags para evitar execucao duplicada no mesmo periodo
// ═══════════════════════════════════════════════════════════════════════════

let lastDailyRunDate = "";
let lastWeeklyRunDate = "";
let lastMonthlyRunMonth = "";

// ═══════════════════════════════════════════════════════════════════════════
// TASKS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Roda a cada ~60s. Executa consolidacao diaria se:
 * - Hora BRT >= 23
 * - Ainda nao rodou hoje
 * - Vault disponivel
 */
export async function vaultDailyTask(): Promise<void> {
  const { date, hour } = nowBRT();

  // So rodar entre 23:00-23:59 BRT
  if (hour < 23) return;

  // Ja rodou hoje?
  if (lastDailyRunDate === date) return;

  // Vault disponivel?
  if (!(await isVaultAvailable())) return;

  console.log(`[Worker][Vault Daily] Iniciando consolidacao para ${date}...`);
  const result = await runDailyConsolidation(date);
  lastDailyRunDate = date;
  console.log(`[Worker][Vault Daily] Concluido: ${result.notePath} (${result.inboxProcessed} inbox items)`);
}

/**
 * Roda a cada ~60s. Executa consolidacao semanal se:
 * - Domingo
 * - Hora BRT >= 23
 * - Ainda nao rodou esta semana
 * - Vault disponivel
 */
export async function vaultWeeklyTask(): Promise<void> {
  const { date, hour, dayOfWeek } = nowBRT();

  // So rodar domingo (0) entre 23:00-23:59 BRT
  if (dayOfWeek !== 0 || hour < 23) return;

  // Ja rodou este domingo?
  if (lastWeeklyRunDate === date) return;

  // Vault disponivel?
  if (!(await isVaultAvailable())) return;

  console.log(`[Worker][Vault Weekly] Iniciando consolidacao semanal...`);
  const result = await runWeeklyConsolidation();
  lastWeeklyRunDate = date;
  console.log(`[Worker][Vault Weekly] Concluido: ${result.notePath} (${result.dailiesProcessed} dailies)`);
}

/**
 * Roda a cada ~60s. Executa meta-analise mensal se:
 * - Ultimo dia do mes
 * - Hora BRT >= 23
 * - Ainda nao rodou este mes
 * - Vault disponivel
 */
export async function vaultMonthlyTask(): Promise<void> {
  const { date, hour, isLastDayOfMonth } = nowBRT();
  const month = date.slice(0, 7); // YYYY-MM

  // So rodar no ultimo dia do mes, entre 23:00-23:59 BRT
  if (!isLastDayOfMonth || hour < 23) return;

  // Ja rodou este mes?
  if (lastMonthlyRunMonth === month) return;

  // Vault disponivel?
  if (!(await isVaultAvailable())) return;

  console.log(`[Worker][Vault Monthly] Iniciando meta-analise para ${month}...`);
  const result = await runMonthlyConsolidation(month);
  lastMonthlyRunMonth = month;
  console.log(`[Worker][Vault Monthly] Concluido: ${result.notePath}`);
}
