-- Estrutura financeira unificada para atendimento e loja.
-- Escopo: novos lançamentos (sem backfill).

CREATE TABLE IF NOT EXISTS public.financial_daily_closures (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  closure_date DATE NOT NULL UNIQUE,
  closed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  totals_by_method JSONB NOT NULL DEFAULT '{}'::jsonb,
  totals_by_origin JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  origin TEXT NOT NULL CHECK (origin IN ('atendimento', 'loja')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  group_code TEXT,
  appointment_id BIGINT REFERENCES public.appointments(id) ON DELETE SET NULL,
  sale_id BIGINT REFERENCES public.sales(id) ON DELETE SET NULL,
  medical_checkout_id BIGINT REFERENCES public.medical_checkouts(id) ON DELETE SET NULL,
  daily_closure_id BIGINT REFERENCES public.financial_daily_closures(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.financial_transaction_payments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  transaction_id BIGINT NOT NULL REFERENCES public.financial_transactions(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('pix', 'cash', 'credit_card', 'debit_card')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_occurred_at
  ON public.financial_transactions(occurred_at);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_origin
  ON public.financial_transactions(origin);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_created_by
  ON public.financial_transactions(created_by);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_appointment
  ON public.financial_transactions(appointment_id);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_sale
  ON public.financial_transactions(sale_id);

CREATE INDEX IF NOT EXISTS idx_financial_transaction_payments_transaction
  ON public.financial_transaction_payments(transaction_id);

CREATE INDEX IF NOT EXISTS idx_financial_transaction_payments_method
  ON public.financial_transaction_payments(payment_method);

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS origin TEXT;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS appointment_id BIGINT REFERENCES public.appointments(id) ON DELETE SET NULL;

UPDATE public.sales
SET origin = COALESCE(origin, 'loja')
WHERE origin IS NULL;
