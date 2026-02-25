import { NextResponse } from "next/server";
import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import { createClient } from "@/lib/supabase/server";
import { requireApprovedProfile } from "@/lib/auth/requireApprovedProfile";
import { getAnalystGraph } from "@/ai/analyst/graph";

type AnalystHistoryItem = {
  role: "user" | "assistant";
  content: string;
};

function toTextContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "text" in item) {
          return String((item as { text?: unknown }).text ?? "");
        }
        return "";
      })
      .join("\n")
      .trim();
  }
  return "";
}

function buildMessages(question: string, history?: AnalystHistoryItem[]): BaseMessage[] {
  const prior = (history ?? [])
    .filter((item) => item && typeof item.content === "string" && item.content.trim().length > 0)
    .map((item) =>
      item.role === "assistant" ? new AIMessage(item.content) : new HumanMessage(item.content)
    );

  return [...prior, new HumanMessage(question)];
}

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY nao configurada." },
        { status: 500 }
      );
    }

    const supabase = await createClient();
    await requireApprovedProfile(supabase, { allowedRoles: ["admin", "secretary"] });

    const body = (await request.json()) as {
      question?: unknown;
      history?: unknown;
    };

    const question = typeof body.question === "string" ? body.question.trim() : "";
    if (!question) {
      return NextResponse.json(
        { error: "Campo 'question' e obrigatorio." },
        { status: 400 }
      );
    }

    const history = Array.isArray(body.history)
      ? (body.history as AnalystHistoryItem[])
      : undefined;

    const graph = await getAnalystGraph();
    const finalState = await graph.invoke({
      messages: buildMessages(question, history),
      current_analysis_context: undefined,
      active_filters: undefined,
    });

    const allMessages = (finalState?.messages ?? []) as BaseMessage[];
    const lastAssistant = [...allMessages]
      .reverse()
      .find((m) => m instanceof AIMessage) as AIMessage | undefined;

    return NextResponse.json({
      answer: lastAssistant ? toTextContent(lastAssistant.content) : "Nao foi possivel gerar resposta.",
    });
  } catch (error) {
    console.error("[/api/ai/analyst] erro:", error);
    const message =
      error instanceof Error ? error.message : "Erro inesperado ao processar analise.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
