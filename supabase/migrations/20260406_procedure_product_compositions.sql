-- Migration: Composicao de Procedimentos com Produtos do Estoque
-- Schema: atendimento (procedure) + public (products)

-- ============================================================
-- 1. Nova tabela: Composicao Procedimento ↔ Produto
-- ============================================================
CREATE TABLE IF NOT EXISTS atendimento.procedure_product_compositions (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  procedure_id    uuid          NOT NULL REFERENCES atendimento.procedures(id) ON DELETE CASCADE,
  product_id      integer       NOT NULL,
  quantity        numeric(10,3) NOT NULL DEFAULT 1,
  purchase_price  numeric(10,2) NOT NULL DEFAULT 0,
  cost_price      numeric(10,2) NOT NULL DEFAULT 0,
  created_at      timestamptz   DEFAULT now()
);

-- Cross-schema FK para public.products
ALTER TABLE atendimento.procedure_product_compositions
  ADD CONSTRAINT fk_proc_prod_composition_product
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

-- Sem duplicatas: mesmo produto nao pode aparecer 2x no mesmo procedimento
CREATE UNIQUE INDEX IF NOT EXISTS idx_proc_prod_unique
  ON atendimento.procedure_product_compositions(procedure_id, product_id);

CREATE INDEX IF NOT EXISTS idx_proc_prod_procedure
  ON atendimento.procedure_product_compositions(procedure_id);

-- ============================================================
-- 2. RLS
-- ============================================================
ALTER TABLE atendimento.procedure_product_compositions ENABLE ROW LEVEL SECURITY;

CREATE POLICY proc_prod_select ON atendimento.procedure_product_compositions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY proc_prod_insert ON atendimento.procedure_product_compositions
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY proc_prod_update ON atendimento.procedure_product_compositions
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY proc_prod_delete ON atendimento.procedure_product_compositions
  FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 3. Novos campos em atendimento.procedures
-- ============================================================
ALTER TABLE atendimento.procedures
  ADD COLUMN IF NOT EXISTS way_id                    text,
  ADD COLUMN IF NOT EXISTS note                      text,
  ADD COLUMN IF NOT EXISTS composition_value         numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS honorarium_value          numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS formula_id                text,
  -- Custos variaveis
  ADD COLUMN IF NOT EXISTS treatment_composition     numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_costs               numeric(10,2) DEFAULT 0,
  -- Despesas variaveis
  ADD COLUMN IF NOT EXISTS card_tax                  numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission                numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount                  numeric(5,2) DEFAULT 0,
  -- Impostos
  ADD COLUMN IF NOT EXISTS inss                      numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS irrf                      numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS irpj                      numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS csll                      numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pis                       numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cofins                    numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cpp                       numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS iss                       numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_tax                 numeric(5,2) DEFAULT 0,
  -- Margem de contribuicao
  ADD COLUMN IF NOT EXISTS contribution_margin       numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contribution_margin_type  text DEFAULT 'percentage';
