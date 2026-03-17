-- Migração: Tabela de CIDs do paciente (diagnósticos)
-- Schema: atendimento
-- Totalmente idempotente

CREATE TABLE IF NOT EXISTS atendimento.patient_cids (
  id BIGSERIAL PRIMARY KEY,
  patient_id BIGINT NOT NULL,
  doctor_id INTEGER,
  cid_code TEXT NOT NULL,
  cid_description TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'chronic')),
  notes TEXT,
  diagnosed_at DATE DEFAULT CURRENT_DATE,
  resolved_at DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_cids_patient ON atendimento.patient_cids(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_cids_code ON atendimento.patient_cids(cid_code);

ALTER TABLE atendimento.patient_cids ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'patient_cids' AND policyname = 'patient_cids_all' AND schemaname = 'atendimento') THEN
    CREATE POLICY "patient_cids_all" ON atendimento.patient_cids FOR ALL USING (true) WITH CHECK (true);
  END IF;
END
$$;
