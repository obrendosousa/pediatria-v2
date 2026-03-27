import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

// PUT /api/profile — atualizar nome
export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;
    const { user, supabase } = auth;

    const body = await req.json();
    const { full_name } = body;

    if (!full_name || typeof full_name !== 'string' || full_name.trim().length < 2) {
      return NextResponse.json({ error: 'Nome inválido' }, { status: 400 });
    }

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: full_name.trim() })
      .eq('id', user.id);

    if (error) {
      console.error('[profile] Update error:', error);
      return NextResponse.json({ error: 'Erro ao atualizar perfil' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[profile] Unexpected error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
