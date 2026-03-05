import { createBrowserClient } from '@supabase/ssr';
import { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Cache por schema para evitar criar múltiplas instâncias do mesmo schema
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const clientCache = new Map<string, SupabaseClient<any, any, any>>();

/**
 * Cliente Supabase para Client Components com schema configurável.
 * Usa createBrowserClient com isSingleton: false para criar instâncias separadas por schema,
 * mas que compartilham o mesmo cookie storage de auth (document.cookie).
 * Isso garante que a sessão do usuário (login) funcione em qualquer schema.
 */
export function createSchemaClient(schema: string = 'public') {
  const cached = clientCache.get(schema);
  if (cached) return cached;

  // isSingleton: false evita retornar o singleton do schema 'public'
  // O auth storage é cookie-based (document.cookie), igual ao createBrowserClient padrão
  const client = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    isSingleton: false,
    db: { schema },
  });

  clientCache.set(schema, client);
  return client;
}
