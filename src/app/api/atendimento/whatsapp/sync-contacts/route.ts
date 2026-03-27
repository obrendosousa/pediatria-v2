import { NextResponse } from 'next/server';

/**
 * POST /api/atendimento/whatsapp/sync-contacts
 * Proxy para o endpoint principal com schema=atendimento
 */
export async function POST(req: Request) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const body = await req.json().catch(() => ({}));

  const res = await fetch(`${appUrl}/api/whatsapp/sync-contacts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, schema: 'atendimento' }),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
