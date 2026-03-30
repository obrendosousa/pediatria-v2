import { NextResponse } from "next/server";
import { createSchemaAdminClient } from "@/lib/supabase/schemaServer";
import { copilotGeralGraph } from "@/ai/copilot-geral/graph";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { chat_id } = body;

    if (!chat_id) {
      return NextResponse.json({ error: "O chat_id é obrigatório." }, { status: 400 });
    }

    const supabase = createSchemaAdminClient("atendimento");

    // 1. Busca os dados do chat para contexto e validação
    const { data: chatData, error: chatError } = await supabase
      .from("chats")
      .select("id, contact_name, phone")
      .eq("id", chat_id)
      .single();

    if (chatError || !chatData) {
      return NextResponse.json({ error: "Chat não encontrado." }, { status: 404 });
    }

    // 2. Busca as últimas 15 mensagens do chat
    const { data: messagesData, error: messagesError } = await supabase
      .from("chat_messages")
      .select("sender, message_text, message_type, created_at")
      .eq("chat_id", chat_id)
      .order("created_at", { ascending: false })
      .limit(15);

    if (messagesError || !messagesData || messagesData.length === 0) {
      return NextResponse.json({ message: "Nenhuma mensagem para analisar." }, { status: 200 });
    }

    // 3. Formatação da Transcrição
    const transcript = messagesData
      .reverse()
      .map((msg) => {
        const isClinic = (msg as Record<string, unknown>).sender === "HUMAN_AGENT" || (msg as Record<string, unknown>).sender === "AI_AGENT" || (msg as Record<string, unknown>).sender === "me";
        const senderName = isClinic ? "Clínica" : ((chatData as Record<string, unknown>).contact_name as string || "Paciente");

        let content = (msg as Record<string, unknown>).message_text as string | null;
        if (!content || content.trim() === "") {
          content = `[Mídia enviada: ${(msg as Record<string, unknown>).message_type || "desconhecido"}]`;
        }

        const timeString = new Date((msg as Record<string, unknown>).created_at as string).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

        return `[${timeString}] ${senderName}: ${content}`;
      })
      .join("\n");

    // 4. Invoca o copiloto da clínica geral
    await copilotGeralGraph.invoke({
      chat_id: (chatData as Record<string, unknown>).id as number,
      patient_name: (chatData as Record<string, unknown>).contact_name as string || "Paciente",
      chat_history: transcript,
      messages: [],
    });

    return NextResponse.json({ success: true, message: "Copiloto executado com sucesso." }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro interno no servidor.";
    console.error("[clinica-geral/trigger] Erro:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
