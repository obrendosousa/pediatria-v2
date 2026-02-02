import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { phone, status, duration } = await req.json();
    
    // Configurações da Evolution API
    const baseUrl = process.env.EVOLUTION_API_URL?.replace(/\/$/, '');
    const instance = process.env.EVOLUTION_INSTANCE;
    const apiKey = process.env.EVOLUTION_API_KEY!;

    if (!baseUrl || !instance || !apiKey) {
      return NextResponse.json({ error: 'Configuração de API ausente' }, { status: 500 });
    }

    // Envia o comando de presença (composing/recording)
    // O 'delay' aqui instrui a Evolution a manter o status por X milissegundos
    await fetch(`${baseUrl}/chat/sendPresence/${instance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      },
      body: JSON.stringify({
        number: phone,
        presence: status, // 'composing' ou 'recording'
        delay: duration || 2000 // Tempo em ms que o status ficará ativo no WhatsApp
      })
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[PRESENCE API] Erro:', error);
    return NextResponse.json({ error: 'Falha ao definir presença' }, { status: 500 });
  }
}