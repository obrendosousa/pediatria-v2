import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncKnowledgeToVault } from "@/ai/vault/sync";

// Client sem generics de tipo para acessar tabelas sem generated types
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { chat_id, original_context, final_text, action } = body as {
      chat_id: number;
      original_context?: string;
      final_text?: string;
      action: string;
    };

    if (!chat_id || !action) {
      return NextResponse.json(
        { error: "chat_id e action são obrigatórios." },
        { status: 400 }
      );
    }

    // 1. Limpa os campos de draft no chat independentemente da acao
    const { error: clearError } = await supabase
      .from("chats")
      .update({ ai_draft_reply: null, ai_draft_reason: null })
      .eq("id", chat_id);

    if (clearError) {
      console.error(`[Feedback] Falha ao limpar draft do chat ${chat_id}:`, clearError.message);
    }

    // 2. Se aprovado ou editado, registra como exemplo no knowledge_base (Few-Shot Learning)
    if ((action === "approved" || action === "edited") && original_context && final_text) {
      const { error: insertError } = await supabase
        .from("knowledge_base")
        .insert({
          pergunta: original_context,
          resposta_ideal: final_text,
          categoria: "copiloto_feedback",
          tags: `chat_id:${chat_id}`,
        });

      if (insertError) {
        console.error(`[Feedback] Falha ao salvar exemplo no knowledge_base:`, insertError.message);
      } else {
        console.log(`[Feedback] Exemplo aprovado salvo. Chat: ${chat_id} | Acao: ${action}`);

        // 3. Sync para o vault (fire-and-forget)
        syncKnowledgeToVault(original_context, final_text, "copiloto_feedback").catch(() => {});
      }
    } else {
      console.log(`[Feedback] Draft descartado. Chat: ${chat_id}`);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro interno no servidor.";
    console.error("[Feedback] Erro no endpoint de feedback do Copiloto:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
