import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getGestaoClient } from '@/lib/gestao-auth'
import { updatePreferencesSchema } from '@/lib/gestao-validators'
import type { GestaoPreferences } from '@/types/gestao'

const DEFAULT_PREFERENCES: Omit<GestaoPreferences, 'user_id' | 'updated_at'> = {
  default_board_id: null,
  default_view: 'kanban',
  sidebar_collapsed: false,
  density: 'comfortable',
  notifications_enabled: true,
  notification_sound: true,
  email_digest: 'none',
}

/**
 * GET /api/gestao/preferences
 * Retorna preferências do usuário. Se não existirem, retorna defaults.
 */
export async function GET() {
  try {
    const auth = await requireAuth()
    if ('error' in auth) return auth.error
    const { user, supabase } = auth

    const gestao = getGestaoClient(supabase)
    const { data, error } = await gestao
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found — retornamos defaults
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const preferences = data || {
      user_id: user.id,
      ...DEFAULT_PREFERENCES,
      updated_at: new Date().toISOString(),
    }

    return NextResponse.json({ data: preferences })
  } catch (err) {
    console.error('[GET /api/gestao/preferences]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

/**
 * PATCH /api/gestao/preferences
 * Atualiza preferências do usuário (upsert).
 */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuth()
    if ('error' in auth) return auth.error
    const { user, supabase } = auth

    const body = await req.json()
    const parsed = updatePreferencesSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const gestao = getGestaoClient(supabase)
    const { data: preferences, error } = await gestao
      .from('user_preferences')
      .upsert(
        {
          user_id: user.id,
          ...parsed.data,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: preferences })
  } catch (err) {
    console.error('[PATCH /api/gestao/preferences]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
