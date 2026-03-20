import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateAndUploadVoice } from '@/ai/voice/client';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: 'atendimento' } }
);

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

    // Formatar senha para fala: "G001" → "G 001"
    const spokenTicket = ticketNumber.replace(/([A-Z])(\d+)/, '$1 $2');
    const text = `Senha ${spokenTicket}, ${patientName}, por favor dirija-se ao ${servicePointName}.`;

    // Gerar audio via TTS (Kokoro/ElevenLabs conforme TTS_BACKEND)
    let audioUrl: string | null = null;
    try {
      audioUrl = await generateAndUploadVoice(text);
    } catch (e) {
      console.error('[Queue TTS] Erro na geracao de voz:', e);
      // Nao bloqueia a chamada se TTS falhar
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

    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      },
      body: JSON.stringify({
        messages: [{
          topic: 'tv-queue',
          event: 'call',
          payload,
        }],
      }),
    }).catch((e) => console.error('[Queue Broadcast] Erro:', e));

    return NextResponse.json({ success: true, audioUrl });
  } catch (error) {
    console.error('[Queue Call API] Erro:', error);
    return NextResponse.json(
      { error: 'Erro interno ao processar chamada' },
      { status: 500 }
    );
  }
}
