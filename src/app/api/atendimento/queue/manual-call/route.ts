import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateAndUploadVoice } from '@/ai/voice/client';

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
    const { text } = await req.json();

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'Campo "text" obrigatorio' }, { status: 400 });
    }

    const spokenText = text.trim();

    // Buscar voz configurada no painel TV
    const savedVoice = await getSavedVoice();

    // Gerar audio via TTS
    let audioUrl: string | null = null;
    try {
      audioUrl = await generateAndUploadVoice(spokenText, savedVoice);
      console.log('[Manual Call] Audio URL:', audioUrl);
    } catch (e) {
      console.error('[Manual Call] Erro TTS:', e);
    }

    // Broadcast para TV
    const payload = {
      ticket_number: '',
      patient_name: spokenText,
      service_point_name: '',
      service_point_code: '',
      is_priority: false,
      tts_audio_url: audioUrl || undefined,
    };

    const broadcastRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      },
      body: JSON.stringify({
        messages: [{
          topic: 'realtime:tv-queue',
          event: 'call',
          payload,
        }],
      }),
    }).catch((e) => { console.error('[Manual Call Broadcast] Erro:', e); return null; });

    console.log('[Manual Call Broadcast] Status:', broadcastRes?.status);

    return NextResponse.json({ success: true, audioUrl });
  } catch (error) {
    console.error('[Manual Call API] Erro:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
