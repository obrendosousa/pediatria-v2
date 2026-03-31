import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateAndUploadVoice, formatTextForTts } from '@/ai/voice/client';
import { emitTvCall } from '@/lib/tv-events';
import type { TVCallPayload } from '@/types/queue';

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

/** Broadcast para ambos os canais: SSE + Supabase Realtime */
async function broadcastToTV(payload: TVCallPayload) {
  // Canal 1: SSE (para manual-call listeners legados)
  emitTvCall(payload);

  // Canal 2: Supabase Realtime (para o painel TV principal)
  await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`, {
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
  }).catch((e) => console.error('[TV Broadcast] Erro Realtime:', e));
}

/**
 * POST /api/tv/call
 * Rota agnóstica de módulo para chamar paciente na TV.
 * Funciona tanto para pediatria quanto atendimento.
 *
 * Body: {
 *   patientName: string (obrigatório)
 *   servicePointName?: string (ex: "Guichê 1", "Consultório 2")
 *   servicePointCode?: string (ex: "G1", "C2")
 *   doctorName?: string
 *   isPriority?: boolean
 *   ticketNumber?: string (ex: "G12", "P3")
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      patientName,
      servicePointName,
      servicePointCode,
      doctorName,
      isPriority,
      ticketNumber,
    } = body;

    if (!patientName || typeof patientName !== 'string') {
      return NextResponse.json(
        { error: 'Campo "patientName" obrigatório' },
        { status: 400 }
      );
    }

    // Montar texto TTS
    const spokenDest = servicePointName
      ? servicePointName
          .replace(/\bGuiche\b/i, 'Guichê')
          .replace(/\bConsultorio\b/i, 'Consultório')
      : '';

    const ttsText = spokenDest
      ? formatTextForTts(`${patientName}, por favor dirija-se ao ${spokenDest}.`)
      : formatTextForTts(`${patientName}, por favor dirija-se à recepção.`);

    // Gerar áudio TTS
    const savedVoice = await getSavedVoice();
    let audioUrl: string | null = null;
    try {
      audioUrl = await generateAndUploadVoice(ttsText, savedVoice, 0.9);
    } catch (e) {
      console.error('[TV Call] Erro TTS:', e);
    }

    // Montar payload e broadcast
    const payload: TVCallPayload = {
      ticket_number: ticketNumber || '',
      patient_name: patientName,
      service_point_name: servicePointName || '',
      service_point_code: servicePointCode || '',
      doctor_name: doctorName || undefined,
      is_priority: isPriority ?? false,
      tts_audio_url: audioUrl || undefined,
      spoken_text: ttsText,
    };

    await broadcastToTV(payload);

    return NextResponse.json({ success: true, audioUrl, ttsError: !audioUrl });
  } catch (error) {
    console.error('[TV Call API] Erro:', error);
    return NextResponse.json(
      { error: 'Erro interno ao processar chamada' },
      { status: 500 }
    );
  }
}
