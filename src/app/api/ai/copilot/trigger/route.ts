/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/automation/adapters/supabaseAdmin";
import { copilotGraph } from "@/ai/copilot/graph";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { chat_id } = body;

    if (!chat_id) {
      return NextResponse.json({ error: "O chat_id é obrigatório." }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();

    // 1. Busca os dados do chat para contexto e validação
    const { data: chatData, error: chatError } = await supabase
      .from("chats")
      .select("id, contact_name, phone")
      .eq("id", chat_id)
      .single();

    if (chatError || !chatData) {
      return NextResponse.json({ error: "Chat não encontrado." }, { status: 404 });
    }

    // 2. A JANELA DESLIZANTE: Busca as últimas 15 mensagens do chat
    const { data: messagesData, error: messagesError } = await supabase
      .from("chat_messages")
      .select("sender, message_text, message_type, created_at")
      .eq("chat_id", chat_id)
      .order("created_at", { ascending: false })
      .limit(15);

    if (messagesError || !messagesData || messagesData.length === 0) {
      return NextResponse.json({ message: "Nenhuma mensagem para analisar." }, { status: 200 });
    }

    // 2.1 Guard: última mensagem deve ser do paciente, não da clínica
    const lastSender = (messagesData[0] as any).sender;
    const isLastFromClinic = lastSender === "HUMAN_AGENT" || lastSender === "AI_AGENT" || lastSender === "me";

    if (isLastFromClinic) {
      console.log(`[Copiloto] Chat ${chat_id}: ultima mensagem e da clinica (${lastSender}), ignorando.`);
      return NextResponse.json({
        success: true,
        message: "Ultima mensagem nao e do paciente. Copiloto nao acionado.",
      }, { status: 200 });
    }

    // 3. Formatação da Transcrição (Invertemos o array para voltar à ordem cronológica natural)
    const transcript = messagesData
      .reverse()
      .map((msg) => {
        // Normaliza quem enviou a mensagem
        const isClinic = (msg as any).sender === "HUMAN_AGENT" || (msg as any).sender === "AI_AGENT" || (msg as any).sender === "me";
        const senderName = isClinic ? "Clínica" : ((chatData as any).contact_name || "Paciente");
        
        // Tratamento de segurança para mídias sem texto
        let content = (msg as any).message_text;
        if (!content || content.trim() === "") {
           content = `[Mídia enviada: ${(msg as any).message_type || 'desconhecido'}]`;
        }

        // Formata a hora para a IA entender o ritmo da conversa
        const timeString = new Date((msg as any).created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        
        return `[${timeString}] ${senderName}: ${content}`;
      })
      .join("\n");

    // 4. Invoca o Cérebro do Copiloto passando o histórico real
    console.log(`🤖 Acionando Copiloto para o chat ${chat_id}...`);
    
    await copilotGraph.invoke({
      chat_id: (chatData as any).id,
      patient_name: (chatData as any).contact_name || "Paciente",
      chat_history: transcript,
      messages: [] // Iniciamos o motor vazio, forçando a IA a ler a instrução do sistema
    });

    console.log(`✅ Copiloto finalizou a análise do chat ${chat_id}.`);

    return NextResponse.json({ success: true, message: "Copiloto executado com sucesso." }, { status: 200 });

  } catch (error: any) {
    console.error("🚨 Erro na API do Copiloto:", error);
    return NextResponse.json({ error: error.message || "Erro interno no servidor." }, { status: 500 });
  }
}