-- Reset de dados de teste do módulo financeiro/loja.
-- Mantém cadastros base (patients, products, profiles, users, doctors etc).
-- Execute em ambiente de teste:
--   psql -f database/reset_finance_test_data.sql

BEGIN;

-- 1) Fechamentos e lançamentos financeiros
TRUNCATE TABLE
  public.financial_transaction_payments,
  public.financial_transactions,
  public.financial_daily_closures
RESTART IDENTITY CASCADE;

-- 2) Vendas e itens de venda
TRUNCATE TABLE
  public.sale_items,
  public.sales
RESTART IDENTITY CASCADE;

-- 3) Opcional para novo ciclo de checkout: volta checkouts para pendente
-- (remova este bloco se não quiser alterar os checkouts existentes)
UPDATE public.medical_checkouts
SET
  status = 'pending',
  completed_at = NULL
WHERE status = 'completed';

-- 4) Reabre agendamentos finalizados para novo teste financeiro
-- (ajuste o filtro conforme sua necessidade)
UPDATE public.appointments
SET
  amount_paid = 0,
  status = CASE
    WHEN status = 'finished' THEN 'confirmed'
    ELSE status
  END
WHERE amount_paid IS NOT NULL
   OR status = 'finished';

-- 5) Limpa apenas auditoria ligada ao financeiro/checkout/venda
DELETE FROM public.audit_log
WHERE entity_type IN ('financial_transaction', 'sale', 'checkout');

COMMIT;
