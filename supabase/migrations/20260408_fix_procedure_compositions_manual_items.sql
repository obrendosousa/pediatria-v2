-- Migration: Criar tabela procedure_product_compositions + colunas faltantes em procedures
-- A migration original (20260406) nunca foi aplicada no banco de produção.
-- Esta migration cria tudo do zero + suporte a itens manuais.

-- ============================================================
-- 1. Colunas faltantes em atendimento.procedures
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

-- ============================================================
-- 2. Criar tabela procedure_product_compositions (com suporte a itens manuais)
-- ============================================================

CREATE TABLE IF NOT EXISTS atendimento.procedure_product_compositions (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  procedure_id    uuid          NOT NULL REFERENCES atendimento.procedures(id) ON DELETE CASCADE,
  product_id      bigint,                          -- nullable: NULL para itens manuais
  quantity        numeric(10,3) NOT NULL DEFAULT 1,
  purchase_price  numeric(10,2) NOT NULL DEFAULT 0,
  cost_price      numeric(10,2) NOT NULL DEFAULT 0,
  is_manual       boolean       NOT NULL DEFAULT false,
  manual_name     text,                            -- nome do item manual
  product_name    text,                            -- cache do nome (catálogo ou manual)
  created_at      timestamptz   DEFAULT now()
);

-- FK cross-schema para public.products (só pra itens do catálogo, NULLs são ignorados)
ALTER TABLE atendimento.procedure_product_compositions
  ADD CONSTRAINT fk_proc_prod_composition_product
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

-- Unique parcial: mesmo produto do catálogo não aparece 2x no mesmo procedimento
CREATE UNIQUE INDEX IF NOT EXISTS idx_proc_prod_unique
  ON atendimento.procedure_product_compositions(procedure_id, product_id)
  WHERE product_id IS NOT NULL;

-- Index para busca por procedimento
CREATE INDEX IF NOT EXISTS idx_proc_prod_procedure
  ON atendimento.procedure_product_compositions(procedure_id);

-- CHECK: integridade manual vs catálogo
ALTER TABLE atendimento.procedure_product_compositions
  ADD CONSTRAINT chk_manual_or_product
  CHECK (
    (is_manual = true AND product_id IS NULL AND manual_name IS NOT NULL)
    OR
    (is_manual = false AND product_id IS NOT NULL)
  );

-- ============================================================
-- 3. RLS
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
