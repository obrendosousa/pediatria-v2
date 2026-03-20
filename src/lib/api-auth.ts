import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Verifica se o usuário está autenticado via cookie de sessão Supabase.
 * Retorna o user e o cliente supabase autenticado, ou um NextResponse 401.
 */
export async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }
  return { user, supabase } as const;
}
