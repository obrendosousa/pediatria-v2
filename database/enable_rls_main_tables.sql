-- ============================================================
-- RLS nas tabelas principais: só usuários aprovados (profiles)
-- Execute APÓS a migração do app para usar o cliente com JWT (createClient de @/lib/supabase/client).
-- ============================================================

-- Função auxiliar: retorna true se o usuário atual tem profile ativo e aprovado
CREATE OR REPLACE FUNCTION public.current_user_has_approved_profile()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.active = true
      AND p.status = 'approved'
  );
$$;

-- Tabelas a proteger (habilitar RLS e política de “aprovado”)
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'patients', 'appointments', 'chats', 'chat_messages', 'sales', 'sale_items',
    'doctor_schedules', 'schedule_overrides', 'tasks', 'products',
    'medical_records', 'anthropometry_entries', 'automation_rules', 'automation_logs',
    'automation_sent_history', 'scheduled_messages', 'doctors', 'checkouts', 'checkout_items',
    'product_batches', 'financial_transactions', 'financial_transaction_payments',
    'financial_daily_closures', 'stock_movements', 'audit_log'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format(
        'DROP POLICY IF EXISTS "Approved users full access" ON public.%I',
        t
      );
      EXECUTE format(
        'CREATE POLICY "Approved users full access" ON public.%I
         FOR ALL
         USING (public.current_user_has_approved_profile())
         WITH CHECK (public.current_user_has_approved_profile())',
        t
      );
    END IF;
  END LOOP;
END $$;

-- Comentário
COMMENT ON FUNCTION public.current_user_has_approved_profile() IS 'Usado pelas políticas RLS: retorna true se auth.uid() tem profile ativo e aprovado.';
