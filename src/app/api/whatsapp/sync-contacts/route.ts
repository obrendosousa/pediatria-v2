import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEvolutionConfig } from '@/lib/evolution';
import { fetchProfilePictureFromEvolution } from '@/ai/ingestion/services';

function getSupabase(schema = 'public') {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    schema !== 'public' ? { db: { schema } } : undefined,
  );
}

function extractPhoneFromJid(jid: string): string | null {
  const raw = String(jid ?? '').trim();
  if (!raw) return null;
  const beforeAt = raw.includes('@') ? raw.split('@')[0] : raw;
  const digits = beforeAt.replace(/\D/g, '');
  return digits && /^\d{8,15}$/.test(digits) ? digits : null;
}

interface SyncResult {
  total_chats: number;
  updated: number;
  skipped: number;
  errors: number;
  details: Array<{ phone: string; contact_name?: string; profile_pic?: boolean }>;
}

/**
 * POST /api/whatsapp/sync-contacts
 *
 * Sincroniza nomes e fotos de perfil de todos os chats existentes
 * buscando dados atualizados da Evolution API (WhatsApp).
 *
 * Body opcional: { schema?: "public" | "atendimento", force?: boolean }
 * - schema: qual banco atualizar (default: public)
 * - force: atualizar mesmo chats que já possuem nome (default: true)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const schema = body.schema === 'atendimento' ? 'atendimento' : 'public';
    const force = body.force !== false; // default true
    const instanceEnvKey = schema === 'atendimento'
      ? 'EVOLUTION_ATENDIMENTO_INSTANCE'
      : 'EVOLUTION_INSTANCE';

    const config = getEvolutionConfig(instanceEnvKey);
    const supabase = getSupabase(schema);

    // 1. Buscar todos os contatos da Evolution API
    const findContactsUrl = `${config.baseUrl}/chat/findContacts/${encodeURIComponent(config.instance)}`;
    const contactsRes = await fetch(findContactsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: config.apiKey },
      body: JSON.stringify({ where: {} }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!contactsRes.ok) {
      const errorText = await contactsRes.text().catch(() => '');
      return NextResponse.json(
        { error: `Evolution API erro: ${contactsRes.status}`, details: errorText },
        { status: 502 },
      );
    }

    const contactsData = await contactsRes.json() as unknown[];
    if (!Array.isArray(contactsData)) {
      return NextResponse.json(
        { error: 'Resposta inesperada da Evolution API', data: contactsData },
        { status: 502 },
      );
    }

    // 2. Indexar contatos por telefone
    const contactsByPhone = new Map<string, { name: string | null; profilePicUrl: string | null }>();
    for (const raw of contactsData) {
      if (!raw || typeof raw !== 'object') continue;
      const c = raw as Record<string, unknown>;
      const jid = String(c.id ?? c.remoteJid ?? '');
      if (!jid || jid.endsWith('@g.us') || jid === 'status@broadcast' || jid.endsWith('@lid')) continue;

      const phone = extractPhoneFromJid(jid);
      if (!phone) continue;

      const name = (
        (typeof c.pushName === 'string' && c.pushName.trim()) ||
        (typeof c.notify === 'string' && (c.notify as string).trim()) ||
        (typeof c.name === 'string' && (c.name as string).trim()) ||
        (typeof c.verifiedName === 'string' && (c.verifiedName as string).trim()) ||
        null
      ) as string | null;

      const profilePicUrl = typeof c.profilePictureUrl === 'string' && (c.profilePictureUrl as string).startsWith('http')
        ? c.profilePictureUrl as string
        : typeof c.profilePicUrl === 'string' && (c.profilePicUrl as string).startsWith('http')
          ? c.profilePicUrl as string
          : null;

      if (name || profilePicUrl) {
        contactsByPhone.set(phone, { name, profilePicUrl });
      }
    }

    console.log(`[SYNC-CONTACTS] ${contactsData.length} contatos da Evolution API, ${contactsByPhone.size} com dados úteis`);

    // 3. Buscar todos os chats do banco
    const { data: chats, error: chatsError } = await supabase
      .from('chats')
      .select('id, phone, contact_name, profile_pic')
      .order('id', { ascending: true });

    if (chatsError) {
      return NextResponse.json({ error: 'Erro ao buscar chats', details: chatsError.message }, { status: 500 });
    }

    if (!chats || chats.length === 0) {
      return NextResponse.json({ message: 'Nenhum chat encontrado', total_chats: 0 });
    }

    // 4. Atualizar chats que têm correspondência nos contatos
    const result: SyncResult = { total_chats: chats.length, updated: 0, skipped: 0, errors: 0, details: [] };

    for (const chat of chats) {
      const phone = String(chat.phone ?? '').trim();
      if (!phone) { result.skipped++; continue; }

      const contact = contactsByPhone.get(phone);
      const updatePayload: Record<string, unknown> = {};

      if (contact?.name) {
        const currentName = (chat.contact_name ?? '').trim();
        const normalizedCurrentName = currentName.replace(/\D/g, '');
        // Atualizar se: force=true, nome vazio, nome = telefone, ou nome diferente
        if (force || !currentName || normalizedCurrentName === phone) {
          updatePayload.contact_name = contact.name;
        }
      }

      if (contact?.profilePicUrl) {
        updatePayload.profile_pic = contact.profilePicUrl;
      }

      // Se contato não encontrado na lista mas force=true, tentar buscar foto individualmente
      if (!contact && force && !chat.profile_pic) {
        const picUrl = await fetchProfilePictureFromEvolution(phone, instanceEnvKey).catch(() => null);
        if (picUrl) {
          updatePayload.profile_pic = picUrl;
        }
      }

      if (Object.keys(updatePayload).length === 0) { result.skipped++; continue; }

      const { error } = await supabase.from('chats').update(updatePayload).eq('id', chat.id);
      if (error) {
        console.error(`[SYNC-CONTACTS] Erro ao atualizar chat ${chat.id} (${phone}):`, error.message);
        result.errors++;
      } else {
        result.updated++;
        result.details.push({
          phone,
          ...(updatePayload.contact_name ? { contact_name: updatePayload.contact_name as string } : {}),
          ...(updatePayload.profile_pic ? { profile_pic: true } : {}),
        });
      }
    }

    console.log(`[SYNC-CONTACTS] Concluído: ${result.updated} atualizados, ${result.skipped} ignorados, ${result.errors} erros`);

    return NextResponse.json({
      success: true,
      schema,
      evolution_contacts: contactsByPhone.size,
      ...result,
    });
  } catch (error) {
    console.error('[SYNC-CONTACTS] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao sincronizar contatos', details: String(error) },
      { status: 500 },
    );
  }
}
