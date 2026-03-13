-- Migration: Receituário — Substâncias, Fórmulas, Protocolos e Medicamentos
-- Schema: atendimento
-- Ref: PRD_CADASTROS_SUPPORT_CLINIC.md §4.1, §4.2, §4.3, §4.4

-- ============================================================
-- 1. Substâncias
-- ============================================================
CREATE TABLE atendimento.substances (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  created_by  uuid,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ============================================================
-- 2. Fórmulas
-- ============================================================
CREATE TABLE atendimento.formulas (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL,
  route_of_use  text        NOT NULL,
  form          text        NOT NULL,
  quantity      numeric     NOT NULL,
  unit          text        NOT NULL,
  posology      text        NOT NULL,
  reference     text,
  notes         text,
  status        text        DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by    uuid,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- ============================================================
-- 3. Composição das Fórmulas
-- ============================================================
CREATE TABLE atendimento.formula_compositions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_id    uuid        NOT NULL REFERENCES atendimento.formulas(id) ON DELETE CASCADE,
  substance_id  uuid        NOT NULL REFERENCES atendimento.substances(id) ON DELETE CASCADE,
  quantity      numeric,
  unit          text,
  sort_order    integer     DEFAULT 0,
  created_at    timestamptz DEFAULT now(),

  CONSTRAINT uq_formula_substance UNIQUE (formula_id, substance_id)
);

-- ============================================================
-- 4. Protocolos de Receituário
-- ============================================================
CREATE TABLE atendimento.prescription_protocols (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  content     text,
  status      text        DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by  uuid,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ============================================================
-- 5. Medicamentos (Industrializados)
-- ============================================================
CREATE TABLE atendimento.medications (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  description         text        NOT NULL,
  presentation        text        NOT NULL,
  active_ingredient   text        NOT NULL,
  barcode             text        NOT NULL,
  type                text        NOT NULL,
  label               text        NOT NULL,
  therapeutic_class   text        NOT NULL,
  created_by          uuid,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- ============================================================
-- 6. Índices
-- ============================================================
CREATE INDEX idx_substances_name            ON atendimento.substances USING gin (name gin_trgm_ops);
CREATE INDEX idx_formulas_status            ON atendimento.formulas (status);
CREATE INDEX idx_formula_comp_formula       ON atendimento.formula_compositions (formula_id);
CREATE INDEX idx_prescription_proto_status  ON atendimento.prescription_protocols (status);
CREATE INDEX idx_medications_description    ON atendimento.medications USING gin (description gin_trgm_ops);
CREATE INDEX idx_medications_barcode        ON atendimento.medications (barcode);

-- ============================================================
-- 7. Triggers updated_at (reutiliza atendimento.set_updated_at)
-- ============================================================
CREATE TRIGGER trg_substances_updated_at
  BEFORE UPDATE ON atendimento.substances
  FOR EACH ROW EXECUTE FUNCTION atendimento.set_updated_at();

CREATE TRIGGER trg_formulas_updated_at
  BEFORE UPDATE ON atendimento.formulas
  FOR EACH ROW EXECUTE FUNCTION atendimento.set_updated_at();

CREATE TRIGGER trg_prescription_protocols_updated_at
  BEFORE UPDATE ON atendimento.prescription_protocols
  FOR EACH ROW EXECUTE FUNCTION atendimento.set_updated_at();

CREATE TRIGGER trg_medications_updated_at
  BEFORE UPDATE ON atendimento.medications
  FOR EACH ROW EXECUTE FUNCTION atendimento.set_updated_at();

-- ============================================================
-- 8. RLS
-- ============================================================
ALTER TABLE atendimento.substances              ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendimento.formulas                ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendimento.formula_compositions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendimento.prescription_protocols  ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendimento.medications             ENABLE ROW LEVEL SECURITY;

-- substances
CREATE POLICY substances_select ON atendimento.substances
  FOR SELECT TO authenticated USING (true);
CREATE POLICY substances_insert ON atendimento.substances
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY substances_update ON atendimento.substances
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY substances_delete ON atendimento.substances
  FOR DELETE TO authenticated USING (true);

-- formulas
CREATE POLICY formulas_select ON atendimento.formulas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY formulas_insert ON atendimento.formulas
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY formulas_update ON atendimento.formulas
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY formulas_delete ON atendimento.formulas
  FOR DELETE TO authenticated USING (true);

-- formula_compositions
CREATE POLICY formula_comp_select ON atendimento.formula_compositions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY formula_comp_insert ON atendimento.formula_compositions
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY formula_comp_update ON atendimento.formula_compositions
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY formula_comp_delete ON atendimento.formula_compositions
  FOR DELETE TO authenticated USING (true);

-- prescription_protocols
CREATE POLICY prescription_proto_select ON atendimento.prescription_protocols
  FOR SELECT TO authenticated USING (true);
CREATE POLICY prescription_proto_insert ON atendimento.prescription_protocols
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY prescription_proto_update ON atendimento.prescription_protocols
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY prescription_proto_delete ON atendimento.prescription_protocols
  FOR DELETE TO authenticated USING (true);

-- medications
CREATE POLICY medications_select ON atendimento.medications
  FOR SELECT TO authenticated USING (true);
CREATE POLICY medications_insert ON atendimento.medications
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY medications_update ON atendimento.medications
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY medications_delete ON atendimento.medications
  FOR DELETE TO authenticated USING (true);
