import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const KOKORO_BASE_URL = process.env.KOKORO_TTS_URL || 'http://localhost:8880';
const PREVIEW_PHRASE = 'Maria Silva, por favor dirija-se ao Consultório 2.';
const BUCKET = 'whatsapp_media';
const AGENT_ID = 'tv_panel';
const CONFIG_KEY = 'voice_previews';

const ALL_VOICES = [
  'pf_dora', 'pm_alex', 'pm_santa',
  'af_heart', 'af_bella', 'af_nova', 'af_sarah', 'af_nicole', 'af_sky',
  'am_adam', 'am_michael',
  'bf_emma', 'bf_lily',
  'ef_dora', 'em_alex',
];

/** Gera audio com Kokoro e faz upload com nome previsivel */
async function generatePreview(voiceId: string): Promise<string | null> {
  try {
    const res = await fetch(`${KOKORO_BASE_URL}/v1/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'kokoro',
        input: PREVIEW_PHRASE,
        voice: voiceId,
        lang_code: 'p',
        response_format: 'mp3',
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      console.error(`[Voice Preview] Kokoro erro ${res.status} para ${voiceId}: ${await res.text()}`);
      return null;
    }

    const audioBuffer = Buffer.from(await res.arrayBuffer());
    const fileName = `kokoro_preview_${voiceId}.mp3`;

    // Upsert: sobrescreve se ja existir
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, audioBuffer, { contentType: 'audio/mpeg', upsert: true });

    if (error) {
      console.error(`[Voice Preview] Upload erro para ${voiceId}:`, error);
      return null;
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
    return urlData.publicUrl;
  } catch (e) {
    console.error(`[Voice Preview] Erro ao gerar ${voiceId}:`, e);
    return null;
  }
}

/** Salva mapa de URLs no agent_config */
async function savePreviewUrls(urls: Record<string, string>) {
  await supabase
    .from('agent_config')
    .upsert(
      { agent_id: AGENT_ID, config_key: CONFIG_KEY, content: JSON.stringify(urls), updated_at: new Date().toISOString() },
      { onConflict: 'agent_id,config_key' }
    );
}

/** Carrega mapa de URLs salvo */
async function loadPreviewUrls(): Promise<Record<string, string>> {
  const { data } = await supabase
    .from('agent_config')
    .select('content')
    .eq('agent_id', AGENT_ID)
    .eq('config_key', CONFIG_KEY)
    .maybeSingle();
  try {
    return data?.content ? JSON.parse(data.content) : {};
  } catch { return {}; }
}

/**
 * GET /api/atendimento/tv/voice-preview
 * Retorna mapa de URLs de preview ja gerados.
 */
export async function GET() {
  try {
    const urls = await loadPreviewUrls();
    return NextResponse.json({ previews: urls });
  } catch (error) {
    console.error('[Voice Preview GET] Erro:', error);
    return NextResponse.json({ previews: {} });
  }
}

/**
 * POST /api/atendimento/tv/voice-preview
 * Body: { voice: string } — gera preview de uma voz especifica
 * Body: { generateAll: true } — gera todas as 15 vozes sequencialmente
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Gerar todas as vozes
    if (body.generateAll) {
      const existingUrls = await loadPreviewUrls();
      const urls: Record<string, string> = { ...existingUrls };
      const results: { voice: string; status: string }[] = [];

      for (const voiceId of ALL_VOICES) {
        // Pula se ja existe (a menos que force=true)
        if (urls[voiceId] && !body.force) {
          results.push({ voice: voiceId, status: 'cached' });
          console.log(`[Voice Preview] ${voiceId}: cached`);
          continue;
        }

        console.log(`[Voice Preview] Gerando ${voiceId}...`);
        const url = await generatePreview(voiceId);
        if (url) {
          urls[voiceId] = url;
          results.push({ voice: voiceId, status: 'generated' });
          // Salva progresso a cada voz gerada
          await savePreviewUrls(urls);
        } else {
          results.push({ voice: voiceId, status: 'failed' });
        }
      }

      return NextResponse.json({ success: true, previews: urls, results });
    }

    // Gerar voz unica
    const { voice } = body;
    if (!voice || typeof voice !== 'string') {
      return NextResponse.json({ error: 'Campo "voice" obrigatorio' }, { status: 400 });
    }

    const audioUrl = await generatePreview(voice);
    if (!audioUrl) {
      return NextResponse.json({ error: 'Falha ao gerar audio de preview' }, { status: 500 });
    }

    // Atualizar mapa salvo
    const urls = await loadPreviewUrls();
    urls[voice] = audioUrl;
    await savePreviewUrls(urls);

    return NextResponse.json({ audioUrl });
  } catch (error) {
    console.error('[Voice Preview] Erro:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
