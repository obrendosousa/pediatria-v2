import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApprovedProfile } from "@/lib/auth/requireApprovedProfile";

// GET /api/chats/[id] — retorna um chat pelo ID (usado pelo Sidebar ao abrir link de relatório da Clara)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    await requireApprovedProfile(supabase, {
      allowedRoles: ["admin", "secretary"],
    });

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
      return NextResponse.json(
        { error: "chat não encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro ao buscar chat.";
    const status =
      message === "Usuário não autenticado."
        ? 401
        : message === "Acesso negado para perfil não aprovado." ||
            message === "Perfil sem permissão para esta ação."
          ? 403
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
