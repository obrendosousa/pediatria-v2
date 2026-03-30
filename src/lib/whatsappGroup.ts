import { evolutionRequest } from './evolution';

// ==================== Helpers ====================

export function isGroupJid(jid: string): boolean {
  return (jid || '').toLowerCase().endsWith('@g.us');
}

export function extractGroupId(groupJid: string): string {
  return groupJid.split('@')[0] || groupJid;
}

export function normalizeJidToPhone(jid: string): string {
  if (!jid) return '';
  return jid.replace(/@.*$/, '').replace(/\D/g, '');
}

// ==================== Types ====================

export interface GroupMetadata {
  subject?: string;
  desc?: string;
  owner?: string;
  size?: number;
  creation?: number;
  restrict?: boolean;
  announce?: boolean;
  pictureUrl?: string | null;
  participants?: Array<{ id: string; admin?: string | null }>;
}

// ==================== Evolution API ====================

export async function fetchGroupMetadata(
  groupJid: string,
  instanceEnvKey?: string
): Promise<GroupMetadata | null> {
  try {
    const res = await evolutionRequest<Record<string, unknown>>(
      `/group/findGroupInfos/{instance}?groupJid=${encodeURIComponent(groupJid)}`,
      { method: 'GET' },
      instanceEnvKey
    );
    if (!res.ok || !res.data || typeof res.data !== 'object') return null;

    const d = res.data as Record<string, unknown>;
    return {
      subject: (d.subject as string) || undefined,
      desc: (d.desc as string) || (d.description as string) || undefined,
      owner: (d.owner as string) || undefined,
      size: (d.size as number) || undefined,
      creation: (d.creation as number) || undefined,
      restrict: (d.restrict as boolean) || undefined,
      announce: (d.announce as boolean) || undefined,
      pictureUrl: (d.pictureUrl as string) || null,
      participants: Array.isArray(d.participants) ? d.participants : undefined,
    };
  } catch (e) {
    console.warn(`[fetchGroupMetadata] Erro ao buscar metadados do grupo ${groupJid}:`, e);
    return null;
  }
}

// ==================== Ensure Group Chat ====================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

export async function ensureGroupChatExists(
  groupJid: string,
  supabase: SupabaseClient,
  pushName?: string,
  instanceEnvKey?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  // 1. Buscar chat existente pelo group_jid
  const { data: existing } = await supabase
    .from('chats')
    .select('*')
    .eq('group_jid', groupJid)
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  // 2. Buscar metadados do grupo na Evolution API
  let groupName = pushName || extractGroupId(groupJid);
  let groupMetadata: Record<string, unknown> = {};
  let groupPic: string | null = null;

  const meta = await fetchGroupMetadata(groupJid, instanceEnvKey);
  if (meta) {
    groupName = meta.subject || groupName;
    groupPic = meta.pictureUrl || null;
    groupMetadata = {
      subject: meta.subject,
      desc: meta.desc,
      owner: meta.owner,
      size: meta.size,
      creation: meta.creation,
      restrict: meta.restrict,
      announce: meta.announce,
      participants: meta.participants,
    };
  }

  // 3. Criar o chat do grupo
  const groupPhone = extractGroupId(groupJid);
  const { data: newChat, error } = await supabase.from('chats').insert({
    phone: groupPhone,
    contact_name: groupName,
    profile_pic: groupPic,
    status: 'ACTIVE',
    is_ai_paused: true, // IA desativada por padrão em grupos
    is_group: true,
    group_jid: groupJid,
    group_metadata: groupMetadata,
    created_at: new Date().toISOString(),
  }).select().single();

  // 4. Race condition — outro worker criou primeiro
  if (error?.code === '23505') {
    const { data: fallback } = await supabase
      .from('chats')
      .select('*')
      .eq('group_jid', groupJid)
      .limit(1)
      .single();
    if (fallback) return fallback;
  }

  if (error && error.code !== '23505') {
    console.error(`[ensureGroupChatExists] Erro ao criar chat do grupo ${groupJid}:`, error);
  }

  return newChat;
}
