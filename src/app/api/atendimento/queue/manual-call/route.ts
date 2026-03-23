import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateAndUploadVoice } from '@/ai/voice/client';
import { emitTvCall } from '@/lib/tv-events';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getSavedVoice(): Promise<string | undefined> {
  try {
    const { data } = await supabase
      .from('agent_config')
      .select('content')
      .eq('agent_id', 'tv_panel')
      .eq('config_key', 'kokoro_voice')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.content || undefined;
  } catch { return undefined; }
}

/**
 * POST /api/atendimento/queue/manual-call
 * Dispara chamada manual na TV sem precisar de ticket/appointment.
 * Body: { text: string } — texto livre que sera falado e exibido na TV
 */
export async function POST(req: NextRequest) {
  try {
    const { text, servicePointName, servicePointCode } = await req.json();

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'Campo "text" obrigatorio' }, { status: 400 });
    }

    const spokenText = text.trim();
    const spName = servicePointName?.trim() || '';
    const spoken = spName ? `${spokenText}, por favor dirija-se ao ${spName}` : spokenText;

    const basePayload = {
      ticket_number: '',
      patient_name: spokenText,
      service_point_name: spName,
      service_point_code: servicePointCode?.trim() || '',
      is_priority: false,
      spoken_text: spoken,
    };

    // Emite via SSE imediatamente — TV recebe e fala via Web Speech API
    emitTvCall(basePayload);
    console.log('[Manual Call] SSE emitido:', spokenText);

    // TTS em background — se Kokoro estiver online, emite segundo evento com áudio
    const savedVoice = await getSavedVoice();
    generateAndUploadVoice(spokenText, savedVoice).then((audioUrl) => {
      if (audioUrl) {
        console.log('[Manual Call] Áudio gerado, emitindo SSE com TTS:', audioUrl);
        emitTvCall({ ...basePayload, tts_audio_url: audioUrl });
      }
    }).catch(() => { /* Kokoro offline — Web Speech API já falou */ });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Manual Call API] Erro:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
