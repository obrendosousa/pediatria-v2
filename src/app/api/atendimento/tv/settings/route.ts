import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const AGENT_ID = 'tv_panel';
const CONFIG_KEY = 'kokoro_voice';

/**
 * GET /api/atendimento/tv/settings
 * Retorna a voz configurada para o painel TV.
 */
export async function GET() {
  try {
    // order by updated_at para pegar sempre o mais recente (evita problema de linhas duplicadas)
    const { data, error } = await supabase
      .from('agent_config')
      .select('content')
      .eq('agent_id', AGENT_ID)
      .eq('config_key', CONFIG_KEY)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) console.error('[TV Settings GET] Erro DB:', error);
    console.log('[TV Settings GET] voz lida:', data?.content);
    return NextResponse.json({ voice: data?.content || 'pf_dora' });
  } catch (error) {
    console.error('[TV Settings GET] Erro:', error);
    return NextResponse.json({ voice: 'pf_dora' });
  }
}

/**
 * POST /api/atendimento/tv/settings
 * Salva a voz selecionada. Body: { voice: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { voice } = await req.json();

    if (!voice || typeof voice !== 'string') {
      return NextResponse.json({ error: 'Campo "voice" obrigatorio' }, { status: 400 });
    }

    // Verifica se já existe um registro
    const { data: existing } = await supabase
      .from('agent_config')
      .select('id')
      .eq('agent_id', AGENT_ID)
      .eq('config_key', CONFIG_KEY)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let dbError;
    if (existing?.id) {
      // Atualiza o registro existente pelo id
      const { error } = await supabase
        .from('agent_config')
        .update({ content: voice, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      dbError = error;
    } else {
      // Insere novo registro
      const { error } = await supabase
        .from('agent_config')
        .insert({ agent_id: AGENT_ID, config_key: CONFIG_KEY, content: voice, updated_at: new Date().toISOString() });
      dbError = error;
    }

    if (dbError) {
      console.error('[TV Settings POST] Erro DB:', dbError);
      return NextResponse.json({ error: 'Erro ao salvar configuracao' }, { status: 500 });
    }

    console.log('[TV Settings POST] Voz salva:', voice, '| id:', existing?.id ?? 'novo');
    return NextResponse.json({ success: true, voice });
  } catch (error) {
    console.error('[TV Settings POST] Erro:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
