-- Padroniza domínio de origem financeira para: atendimento | loja.
-- Também remove legado "pendencia", "consulta" e "retorno" do campo origin.

UPDATE public.financial_transactions
SET origin = CASE
  WHEN origin = 'loja' THEN 'loja'
  ELSE 'atendimento'
END
WHERE origin IS NOT NULL;

UPDATE public.sales
SET origin = CASE
  WHEN origin = 'loja' THEN 'loja'
  ELSE 'atendimento'
END
WHERE origin IS NOT NULL;

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = con.connamespace
  WHERE rel.relname = 'financial_transactions'
    AND nsp.nspname = 'public'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%origin%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.financial_transactions DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.financial_transactions
  ADD CONSTRAINT financial_transactions_origin_check
  CHECK (origin IN ('atendimento', 'loja'));
