-- Migration: Procedimentos por Profissional
-- Cada profissional define seus próprios procedimentos com valor e regra de divisão

CREATE TABLE atendimento.professional_procedures (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id   uuid          NOT NULL REFERENCES atendimento.professionals(id) ON DELETE CASCADE,
  name              text          NOT NULL,
  procedure_type    text          NOT NULL CHECK (procedure_type IN ('consultation','exam','injectable','other')),
  duration_minutes  integer       NOT NULL DEFAULT 30,
  value             numeric(10,2) NOT NULL DEFAULT 0,       -- Valor cobrado do paciente
  split_type        text          NOT NULL DEFAULT 'percentage' CHECK (split_type IN ('percentage', 'fixed')),
  split_value       numeric(10,2) NOT NULL DEFAULT 0,       -- % ou R$ do profissional
  status            text          DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at        timestamptz   DEFAULT now(),
  updated_at        timestamptz   DEFAULT now()
);

CREATE INDEX idx_prof_proc_professional ON atendimento.professional_procedures (professional_id, status);

CREATE TRIGGER trg_prof_proc_updated_at
  BEFORE UPDATE ON atendimento.professional_procedures
  FOR EACH ROW EXECUTE FUNCTION atendimento.set_updated_at();

ALTER TABLE atendimento.professional_procedures ENABLE ROW LEVEL SECURITY;

CREATE POLICY prof_proc_all ON atendimento.professional_procedures
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
