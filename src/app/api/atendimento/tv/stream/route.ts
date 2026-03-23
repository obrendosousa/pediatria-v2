import { NextRequest } from 'next/server';
import { tvEmitter } from '@/lib/tv-events';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/atendimento/tv/stream
 * SSE stream — a TV conecta aqui e recebe eventos de chamada em tempo real.
 */
export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  let cleanup: (() => void) | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => {
        try { controller.enqueue(encoder.encode(chunk)); } catch { /* cliente desconectou */ }
      };

      // Keepalive para evitar timeout de proxies
      const keepAlive = setInterval(() => send(': keep-alive\n\n'), 25_000);

      const handler = (data: string) => send(`data: ${data}\n\n`);
      tvEmitter.on('call', handler);

      cleanup = () => {
        clearInterval(keepAlive);
        tvEmitter.off('call', handler);
        try { controller.close(); } catch { /* já fechado */ }
      };
    },
    cancel() { cleanup?.(); },
  });

  req.signal.addEventListener('abort', () => cleanup?.());

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
