import { NextResponse } from 'next/server';
import { runScheduledAnalysis, logCronExecution } from '@/ai/neural-network/scheduled-analysis';

export async function GET(request: Request) {
  const secret = new URL(request.url).searchParams.get('secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runScheduledAnalysis('monthly');
    await logCronExecution('monthly', result);
    return NextResponse.json({ type: 'monthly', ...result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
