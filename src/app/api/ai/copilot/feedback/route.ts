import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/automation/adapters/supabaseAdmin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { chat_id, original_context, draft_text, final_text, action } = body;

    if (!chat_id || !action) {
      return NextResponse.json(
        { error: "chat_id e action são obrigatórios." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdminClient();

    // 1. Limpa os campos de draft no chat independentemente da ação
    const { error: clearError } = await (supabase as any)
      .from("chats")
      .update({ ai_draft_reply: null, ai_draft_reason: null })
      .eq("id", chat_id);

    if (clearError) {
      console.error(`🚨 [Feedback] Falha ao limpar draft do chat ${chat_id}:`, clearError.message);
    }

    // 2. Se aprovado ou editado, registra como exemplo no knowledge_base (Few-Shot Learning)
    if ((action === "approved" || action === "edited") && original_context && final_text) {
      const { error: insertError } = await (supabase as any)
        .from("knowledge_base")
        .insert({
          pergunta: original_context,
          resposta_ideal: final_text,
          categoria: "copiloto_feedback",
          tags: `chat_id:${chat_id}`,
        });

      if (insertError) {
        console.error(`🚨 [Feedback] Falha ao salvar exemplo no knowledge_base:`, insertError.message);
      } else {
        console.log(`✅ [Feedback] Exemplo aprovado salvo. Chat: ${chat_id} | Ação: ${action}`);
      }
    } else {
      console.log(`🗑️ [Feedback] Draft descartado. Chat: ${chat_id}`);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("🚨 Erro no endpoint de feedback do Copiloto:", error);
    return NextResponse.json(
      { error: error.message || "Erro interno no servidor." },
      { status: 500 }
    );
  }
}
