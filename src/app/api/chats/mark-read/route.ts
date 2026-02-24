import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const chatId = Number(body?.chatId);

    if (!Number.isFinite(chatId) || chatId <= 0) {
      return NextResponse.json({ error: "chatId inválido" }, { status: 400 });
    }

    const { error } = await supabase
      .from("chats")
      .update({ unread_count: 0 })
      .eq("id", chatId);

    if (error) {
      console.error("[mark-read] erro:", error);
      return NextResponse.json({ error: "Falha ao marcar como lida" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[mark-read] erro inesperado:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
