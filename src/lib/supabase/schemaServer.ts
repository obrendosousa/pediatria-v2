import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Cliente Supabase Admin (Service Role) com schema configurável.
 * Para API routes dos módulos que operam em schemas não-public.
 * Bypassa RLS — usar apenas em server-side.
 */
export function createSchemaAdminClient(schema: string = 'public') {
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRole) {
    throw new Error('Supabase admin not configured');
  }
  return createClient(supabaseUrl, serviceRole, {
    db: { schema },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Cliente Supabase Server com schema configurável.
 * Para Server Components, Server Actions e Route Handlers de módulos
 * que operam em schemas não-public (ex: atendimento).
 */
export async function createSchemaServerClient(schema: string = 'public') {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    db: { schema },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Falha esperada em Server Components puros
        }
      },
    },
  });
}
