-- =============================================================
-- Fix: Adicionar RLS policy na tabela medical_checkouts
-- Execute no SQL Editor do Supabase
-- =============================================================

-- 1. Permitir chat_id nulo (pacientes podem não ter chat)
ALTER TABLE public.medical_checkouts ALTER COLUMN chat_id DROP NOT NULL;

-- 2. Criar tabela checkout_items se não existir
CREATE TABLE IF NOT EXISTS public.checkout_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  checkout_id BIGINT REFERENCES public.medical_checkouts(id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES public.products(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  type TEXT DEFAULT 'product',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checkout_items_checkout_id ON public.checkout_items(checkout_id);

-- 3. Habilitar RLS e adicionar política (mesmo padrão das outras tabelas)
ALTER TABLE public.medical_checkouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Approved users full access" ON public.medical_checkouts;
CREATE POLICY "Approved users full access" ON public.medical_checkouts
  FOR ALL
  USING (public.current_user_has_approved_profile())
  WITH CHECK (public.current_user_has_approved_profile());

ALTER TABLE public.checkout_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Approved users full access" ON public.checkout_items;
CREATE POLICY "Approved users full access" ON public.checkout_items
  FOR ALL
  USING (public.current_user_has_approved_profile())
  WITH CHECK (public.current_user_has_approved_profile());

-- 4. Verificar
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'medical_checkouts'
ORDER BY ordinal_position;
