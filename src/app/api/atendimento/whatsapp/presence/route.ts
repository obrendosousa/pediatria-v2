import { NextResponse } from 'next/server';
import { getEvolutionConfig, buildEvolutionEndpoint } from '@/lib/evolution';

const EVOLUTION_INSTANCE_KEY = 'EVOLUTION_ATENDIMENTO_INSTANCE';

export async function POST(req: Request) {
  try {
    const { phone, status, duration } = await req.json();
    const cfg = getEvolutionConfig(EVOLUTION_INSTANCE_KEY);
    const endpoint = buildEvolutionEndpoint('/chat/sendPresence/{instance}', cfg);

    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: cfg.apiKey },
      body: JSON.stringify({
        number: phone,
        presence: status,
        delay: duration || 2000,
      }),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[ATD/Presence] Erro:', error);
    return NextResponse.json({ error: 'Falha ao definir presença' }, { status: 500 });
  }
}
