import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateAndUploadVoice, formatTextForTts } from '@/ai/voice/client';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: 'atendimento' } }
);

const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getSavedVoice(): Promise<string | undefined> {
  try {
    const { data } = await supabasePublic
      .from('agent_config')
      .select('content')
      .eq('agent_id', 'tv_panel')
      .eq('config_key', 'kokoro_voice')
      .maybeSingle();
    return data?.content || undefined;
  } catch { return undefined; }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      ticketId,
      ticketNumber,
      patientName,
      servicePointName,
      servicePointCode,
      doctorName,
      isPriority,
    } = body;

    if (!ticketId || !ticketNumber || !patientName || !servicePointName) {
      return NextResponse.json(
        { error: 'Campos obrigatorios: ticketId, ticketNumber, patientName, servicePointName' },
        { status: 400 }
      );
    }

    // Formatar destino para fala: "Guiche 1" → "Guichê 1", "Consultorio 2" → "Consultório 2"
    const spokenDest = servicePointName
      .replace(/\bGuiche\b/i, 'Guichê')
      .replace(/\bConsultorio\b/i, 'Consultório');
    const text = formatTextForTts(`${patientName}, por favor dirija-se ao ${spokenDest}.`);

    console.log('[Queue Call] Texto TTS:', text);

    // Buscar voz configurada no painel TV
    const savedVoice = await getSavedVoice();

    // Gerar audio via Kokoro TTS
    let audioUrl: string | null = null;
    try {
      audioUrl = await generateAndUploadVoice(text, savedVoice);
      console.log('[Queue Call] Audio URL gerado:', audioUrl);
    } catch (e) {
      console.error('[Queue TTS] Erro na geracao de voz:', e);
    }

    if (!audioUrl) {
      console.error('[Queue Call] Kokoro TTS falhou — broadcast será enviado sem áudio (sem fallback para voz genérica)');
    }

    // Atualizar ticket com URL do audio
    if (audioUrl) {
      await supabase
        .from('queue_tickets')
        .update({ tts_audio_url: audioUrl })
        .eq('id', ticketId);
    }

    // Broadcast via Supabase Realtime para o painel TV
    const payload = {
      ticket_number: ticketNumber,
      patient_name: patientName,
      service_point_name: servicePointName,
      service_point_code: servicePointCode || '',
      doctor_name: doctorName || undefined,
      is_priority: isPriority ?? false,
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
    }).catch((e) => { console.error('[Queue Broadcast] Erro:', e); return null; });
    console.log('[Queue Broadcast] Status:', broadcastRes?.status, broadcastRes?.statusText);

    return NextResponse.json({ success: true, audioUrl, ttsError: !audioUrl });
  } catch (error) {
    console.error('[Queue Call API] Erro:', error);
    return NextResponse.json(
      { error: 'Erro interno ao processar chamada' },
      { status: 500 }
    );
  }
}
