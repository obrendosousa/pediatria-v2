-- Bridge table: links appointments to procedures with financial + commission data
CREATE TABLE atendimento.appointment_procedures (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id             bigint NOT NULL REFERENCES atendimento.appointments(id) ON DELETE CASCADE,
  source_type                text NOT NULL CHECK (source_type IN ('global', 'professional')),
  procedure_id               uuid NULL,
  professional_procedure_id  uuid NULL,
  procedure_name             text NOT NULL,
  procedure_type             text NULL,
  duration_minutes           integer NULL,
  unit_value                 numeric(12,2) NOT NULL DEFAULT 0,
  quantity                   integer NOT NULL DEFAULT 1,
  line_total                 numeric(12,2) NOT NULL DEFAULT 0,
  split_type                 text NULL CHECK (split_type IN ('percentage', 'fixed')),
  split_value                numeric(10,2) NULL,
  doctor_commission          numeric(12,2) NULL,
  clinic_amount              numeric(12,2) NULL,
  created_at                 timestamptz DEFAULT now(),
  CONSTRAINT chk_source_fk CHECK (
    (source_type = 'global' AND procedure_id IS NOT NULL) OR
    (source_type = 'professional' AND professional_procedure_id IS NOT NULL)
  )
);

CREATE INDEX idx_apt_proc_appointment ON atendimento.appointment_procedures(appointment_id);
ALTER TABLE atendimento.appointment_procedures ENABLE ROW LEVEL SECURITY;
CREATE POLICY apt_proc_all ON atendimento.appointment_procedures
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
