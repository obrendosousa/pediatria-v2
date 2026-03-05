import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Cache por schema para evitar criar múltiplas instâncias do mesmo schema
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const clientCache = new Map<string, SupabaseClient<any, any, any>>();

/**
 * Cliente Supabase para Client Components com schema configurável.
 * Usa createClient (não createBrowserClient) para permitir instâncias separadas por schema.
 * Usado pelos módulos que operam em schemas não-public (ex: atendimento).
 */
export function createSchemaClient(schema: string = 'public') {
  const cached = clientCache.get(schema);
  if (cached) return cached;

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    db: { schema },
    auth: {
      persistSession: true,
      storageKey: `sb-${schema}-auth-token`,
    },
  });

  clientCache.set(schema, client);
  return client;
}
