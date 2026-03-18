// ═══════════════════════════════════════════════════════════════════════════
// CAMADA 9: Spot-Check Verifier
// Verifica citações do inner LLM contra dados reais no banco.
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from "@supabase/supabase-js";

export interface SpotCheckResult {
  total_checked: number;
  confirmed: number;
  failed: number;
  details: {
    citation: { chat_id: number; text: string; sender: string };
    found: boolean;
    actual_text?: string;
  }[];
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

function sanitizeForIlike(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

/**
 * Extrai citações do formato __SPOT_CHECK_DATA__ no output da analyze_raw_conversations.
 */
export function extractSpotCheckData(
  toolOutput: string
): Array<{ chat_id: number; text: string; sender: string }> {
  const marker = "__SPOT_CHECK_DATA__:";
  const idx = toolOutput.indexOf(marker);
  if (idx === -1) return [];

  const jsonStr = toolOutput.slice(idx + marker.length).trim();
  try {
    const raw = JSON.parse(jsonStr);
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item: string) => {
        try {
          return JSON.parse(item);
        } catch {
          return null;
        }
      })
      .filter(
        (item: unknown): item is { chat_id: number; text: string; sender: string } =>
          item !== null && typeof item === "object" && "chat_id" in (item as Record<string, unknown>) && typeof (item as Record<string, unknown>).chat_id === "number" && "text" in (item as Record<string, unknown>) && typeof (item as Record<string, unknown>).text === "string"
      );
  } catch {
    return [];
  }
}

/**
 * Verifica citações contra o banco de dados real.
 * Executa busca parcial (ILIKE) no message_text por chat_id e sender.
 */
export async function spotCheckCitations(
  citations: Array<{ chat_id: number; text: string; sender: string }>,
  supabase: SupabaseClient
): Promise<SpotCheckResult> {
  const toCheck = citations.slice(0, 5);
  const results: SpotCheckResult["details"] = [];

  for (const citation of toCheck) {
    const searchText = sanitizeForIlike(citation.text.slice(0, 100));

    // Busca primária: chat_id + sender + trecho
    const { data } = await supabase
      .from("chat_messages")
      .select("message_text, sender")
      .eq("chat_id", citation.chat_id)
      .eq("sender", citation.sender)
      .ilike("message_text", `%${searchText}%`)
      .limit(1);

    if (data && data.length > 0) {
      results.push({
        citation,
        found: true,
        actual_text: data[0].message_text,
      });
    } else {
      // Busca mais ampla: só chat_id + trecho (sem sender)
      const { data: broader } = await supabase
        .from("chat_messages")
        .select("message_text, sender")
        .eq("chat_id", citation.chat_id)
        .ilike("message_text", `%${sanitizeForIlike(citation.text.slice(0, 60))}%`)
        .limit(1);

      results.push({
        citation,
        found: broader !== null && broader.length > 0,
        actual_text: broader?.[0]?.message_text,
      });
    }
  }

  const confirmed = results.filter((r) => r.found).length;
  const total = results.length;
  const ratio = total > 0 ? confirmed / total : 0;

  return {
    total_checked: total,
    confirmed,
    failed: total - confirmed,
    details: results,
    confidence: ratio >= 1 ? "HIGH" : ratio >= 0.6 ? "MEDIUM" : "LOW",
  };
}
