-- ============================================================
-- Migration: Campos para fluxo de agendamento e cadastro simplificado
-- ============================================================

-- 1. Novos campos no paciente (zona, tipo logradouro, código)
ALTER TABLE atendimento.patients
  ADD COLUMN IF NOT EXISTS patient_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS zone TEXT,
  ADD COLUMN IF NOT EXISTS address_type TEXT;

-- 2. Campos no ticket para walk-ins (sem appointment)
ALTER TABLE atendimento.queue_tickets
  ADD COLUMN IF NOT EXISTS patient_id INTEGER,
  ADD COLUMN IF NOT EXISTS patient_name TEXT;

-- 3. Função para gerar código sequencial do paciente (PAC-00001)
CREATE OR REPLACE FUNCTION atendimento.next_patient_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  next_val INTEGER;
BEGIN
  SELECT COALESCE(
    MAX(CAST(SUBSTRING(patient_code FROM 5) AS INTEGER)),
    0
  ) + 1
  INTO next_val
  FROM atendimento.patients
  WHERE patient_code LIKE 'PAC-%';
  RETURN 'PAC-' || LPAD(next_val::TEXT, 5, '0');
END;
$$;

-- 4. Trigger para auto-gerar patient_code no INSERT
CREATE OR REPLACE FUNCTION atendimento.auto_patient_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.patient_code IS NULL OR NEW.patient_code = '' THEN
    NEW.patient_code := atendimento.next_patient_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_patient_code ON atendimento.patients;
CREATE TRIGGER trg_auto_patient_code
  BEFORE INSERT ON atendimento.patients
  FOR EACH ROW
  EXECUTE FUNCTION atendimento.auto_patient_code();
