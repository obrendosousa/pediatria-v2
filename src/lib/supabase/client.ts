import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltam NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

/**
 * Cliente Supabase para uso em Client Components (browser).
 * Usa cookies automaticamente via document.cookie.
 */
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
