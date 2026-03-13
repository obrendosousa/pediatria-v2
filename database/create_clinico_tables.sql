-- Migration: Clínico — Procedimentos, Protocolos e Parceiros
-- Schema: atendimento
-- Ref: PRD_CADASTROS_SUPPORT_CLINIC.md §3.1, §3.2, §3.3

-- ============================================================
-- 1. Procedimentos
-- ============================================================
CREATE TABLE atendimento.procedures (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text          NOT NULL,
  procedure_type      text          NOT NULL CHECK (procedure_type IN (
                        'consultation',
                        'exam',
                        'injectable',
                        'other'
                      )),
  duration_minutes    integer       NOT NULL,
  composition_enabled boolean       DEFAULT false,
  fee_value           numeric(10,2) DEFAULT 0,
  total_value         numeric(10,2) DEFAULT 0,
  status              text          DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by          uuid,
  created_at          timestamptz   DEFAULT now(),
  updated_at          timestamptz   DEFAULT now()
);

-- ============================================================
-- 2. Composição de Procedimentos
-- ============================================================
CREATE TABLE atendimento.procedure_compositions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  procedure_id      uuid        NOT NULL REFERENCES atendimento.procedures(id) ON DELETE CASCADE,
  sub_procedure_id  uuid        NOT NULL REFERENCES atendimento.procedures(id) ON DELETE CASCADE,
  quantity          integer     DEFAULT 1,
  created_at        timestamptz DEFAULT now(),

  CONSTRAINT uq_procedure_composition UNIQUE (procedure_id, sub_procedure_id)
);

-- ============================================================
-- 3. Protocolos Clínicos
-- ============================================================
CREATE TABLE atendimento.clinical_protocols (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text          NOT NULL,
  description text,
  total_value numeric(10,2) DEFAULT 0,
  status      text          DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by  uuid,
  created_at  timestamptz   DEFAULT now(),
  updated_at  timestamptz   DEFAULT now()
);

-- ============================================================
-- 4. Itens dos Protocolos Clínicos
-- ============================================================
CREATE TABLE atendimento.clinical_protocol_items (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id   uuid        NOT NULL REFERENCES atendimento.clinical_protocols(id) ON DELETE CASCADE,
  procedure_id  uuid        NOT NULL REFERENCES atendimento.procedures(id) ON DELETE CASCADE,
  sort_order    integer     DEFAULT 0,
  created_at    timestamptz DEFAULT now(),

  CONSTRAINT uq_protocol_procedure UNIQUE (protocol_id, procedure_id)
);

-- ============================================================
-- 5. Parceiros
-- ============================================================
CREATE TABLE atendimento.partners (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  email       text        NOT NULL,
  phone       text,
  whatsapp    text,
  notes       text,
  status      text        DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by  uuid,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ============================================================
-- 6. Índices
-- ============================================================
CREATE INDEX idx_procedures_status          ON atendimento.procedures (status);
CREATE INDEX idx_procedures_type            ON atendimento.procedures (procedure_type);
CREATE INDEX idx_proc_comp_procedure        ON atendimento.procedure_compositions (procedure_id);
CREATE INDEX idx_clinical_protocols_status  ON atendimento.clinical_protocols (status);
CREATE INDEX idx_cpi_protocol              ON atendimento.clinical_protocol_items (protocol_id);
CREATE INDEX idx_partners_status           ON atendimento.partners (status);

-- ============================================================
-- 7. Triggers updated_at (reutiliza atendimento.set_updated_at)
-- ============================================================
CREATE TRIGGER trg_procedures_updated_at
  BEFORE UPDATE ON atendimento.procedures
  FOR EACH ROW EXECUTE FUNCTION atendimento.set_updated_at();

CREATE TRIGGER trg_clinical_protocols_updated_at
  BEFORE UPDATE ON atendimento.clinical_protocols
  FOR EACH ROW EXECUTE FUNCTION atendimento.set_updated_at();

CREATE TRIGGER trg_partners_updated_at
  BEFORE UPDATE ON atendimento.partners
  FOR EACH ROW EXECUTE FUNCTION atendimento.set_updated_at();

-- ============================================================
-- 8. RLS
-- ============================================================
ALTER TABLE atendimento.procedures              ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendimento.procedure_compositions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendimento.clinical_protocols      ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendimento.clinical_protocol_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendimento.partners                ENABLE ROW LEVEL SECURITY;

-- procedures
CREATE POLICY procedures_select ON atendimento.procedures
  FOR SELECT TO authenticated USING (true);
CREATE POLICY procedures_insert ON atendimento.procedures
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY procedures_update ON atendimento.procedures
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY procedures_delete ON atendimento.procedures
  FOR DELETE TO authenticated USING (true);

-- procedure_compositions
CREATE POLICY proc_comp_select ON atendimento.procedure_compositions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY proc_comp_insert ON atendimento.procedure_compositions
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY proc_comp_update ON atendimento.procedure_compositions
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY proc_comp_delete ON atendimento.procedure_compositions
  FOR DELETE TO authenticated USING (true);

-- clinical_protocols
CREATE POLICY clinical_protocols_select ON atendimento.clinical_protocols
  FOR SELECT TO authenticated USING (true);
CREATE POLICY clinical_protocols_insert ON atendimento.clinical_protocols
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY clinical_protocols_update ON atendimento.clinical_protocols
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY clinical_protocols_delete ON atendimento.clinical_protocols
  FOR DELETE TO authenticated USING (true);

-- clinical_protocol_items
CREATE POLICY cpi_select ON atendimento.clinical_protocol_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY cpi_insert ON atendimento.clinical_protocol_items
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY cpi_update ON atendimento.clinical_protocol_items
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY cpi_delete ON atendimento.clinical_protocol_items
  FOR DELETE TO authenticated USING (true);

-- partners
CREATE POLICY partners_select ON atendimento.partners
  FOR SELECT TO authenticated USING (true);
CREATE POLICY partners_insert ON atendimento.partners
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY partners_update ON atendimento.partners
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY partners_delete ON atendimento.partners
  FOR DELETE TO authenticated USING (true);
