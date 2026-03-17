-- Migração: Tabela de dietas do paciente
-- Schema: atendimento
-- Totalmente idempotente

CREATE TABLE IF NOT EXISTS atendimento.patient_diets (
  id BIGSERIAL PRIMARY KEY,
  patient_id BIGINT NOT NULL,
  doctor_id INTEGER,
  title TEXT NOT NULL,
  content TEXT,
  notes TEXT,
  diet_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_diets_patient ON atendimento.patient_diets(patient_id);

ALTER TABLE atendimento.patient_diets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'patient_diets' AND policyname = 'patient_diets_all' AND schemaname = 'atendimento') THEN
    CREATE POLICY "patient_diets_all" ON atendimento.patient_diets FOR ALL USING (true) WITH CHECK (true);
  END IF;
END
$$;
