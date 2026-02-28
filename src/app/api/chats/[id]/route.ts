import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/chats/[id] — retorna um chat pelo ID (usado pelo Sidebar ao abrir link de relatório da Clara)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const chatId = Number(id);

  if (!Number.isFinite(chatId) || chatId <= 0) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("chats")
    .select("*")
    .eq("id", chatId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "chat não encontrado" }, { status: 404 });
  }

  return NextResponse.json(data);
}
