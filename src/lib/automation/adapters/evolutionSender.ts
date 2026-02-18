import { evolutionRequest } from "@/lib/evolution";

export interface EvolutionSendInput {
  phone: string;
  type: "text" | "audio" | "image" | "video" | "document";
  content: string;
  caption?: string;
}

export interface EvolutionSendResult {
  ok: boolean;
  status: number;
  wppId: string | null;
  details?: unknown;
}

export async function sendWithEvolution(input: EvolutionSendInput): Promise<EvolutionSendResult> {
  const body: Record<string, unknown> = { number: input.phone, delay: 1000 };
  let endpoint = "/message/sendText/{instance}";

  if (input.type === "text") {
    body.text = input.content;
  } else if (input.type === "audio") {
    endpoint = "/message/sendWhatsAppAudio/{instance}";
    body.audio = input.content;
    body.encoding = true;
  } else if (input.type === "image" || input.type === "video" || input.type === "document") {
    endpoint = "/message/sendMedia/{instance}";
    body.media = input.content;
    body.mediatype = input.type === "video" ? "video" : input.type;
    body.caption = input.caption || "";
  }

  const { ok, status, data } = await evolutionRequest(endpoint, { method: "POST", body });
  const result = (data as Record<string, unknown>) || {};
  const keyObj = (result.key as Record<string, unknown>) || {};
  const wppId = (keyObj.id as string) || (result.id as string) || null;

  return { ok, status, wppId, details: data };
}
