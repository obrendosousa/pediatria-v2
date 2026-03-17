-- Migração: Tabelas de Orçamentos (budgets + budget_items)
-- Schema: atendimento
-- Executar no Supabase SQL Editor
-- ⚠️ Totalmente idempotente — pode rodar múltiplas vezes sem erro

-- ── Tabela de orçamentos ──
CREATE TABLE IF NOT EXISTS atendimento.budgets (
  id BIGSERIAL PRIMARY KEY,
  patient_id BIGINT NOT NULL,
  doctor_id BIGINT,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'orcado', 'aprovado', 'rejeitado')),
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_type TEXT DEFAULT '%'
    CHECK (discount_type IN ('%', 'R$')),
  discount_value NUMERIC(12,2) DEFAULT 0,
  discount_amount NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  installments INTEGER DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Tabela de itens do orçamento ──
CREATE TABLE IF NOT EXISTS atendimento.budget_items (
  id BIGSERIAL PRIMARY KEY,
  budget_id BIGINT NOT NULL REFERENCES atendimento.budgets(id) ON DELETE CASCADE,
  procedure_name TEXT NOT NULL,
  sessions INTEGER DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- ── Índices (IF NOT EXISTS) ──
CREATE INDEX IF NOT EXISTS idx_budgets_patient_id ON atendimento.budgets(patient_id);
CREATE INDEX IF NOT EXISTS idx_budgets_status ON atendimento.budgets(status);
CREATE INDEX IF NOT EXISTS idx_budgets_created_at ON atendimento.budgets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_budget_items_budget_id ON atendimento.budget_items(budget_id);

-- ── RLS (idempotente) ──
ALTER TABLE atendimento.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendimento.budget_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'budgets' AND policyname = 'budgets_all' AND schemaname = 'atendimento') THEN
    CREATE POLICY "budgets_all" ON atendimento.budgets FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'budget_items' AND policyname = 'budget_items_all' AND schemaname = 'atendimento') THEN
    CREATE POLICY "budget_items_all" ON atendimento.budget_items FOR ALL USING (true) WITH CHECK (true);
  END IF;
END
$$;
