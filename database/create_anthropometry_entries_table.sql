-- Criação da tabela anthropometry_entries para armazenar histórico de medições antropométricas
-- Esta tabela permite rastrear múltiplas medições ao longo do tempo para cada paciente
-- Script idempotente: pode ser executado múltiplas vezes sem erro

-- Criar tabela se não existir
CREATE TABLE IF NOT EXISTS public.anthropometry_entries (
  id BIGSERIAL PRIMARY KEY,
  patient_id BIGINT NOT NULL,
  appointment_id BIGINT,
  medical_record_id BIGINT,
  
  -- Dados da medição
  measurement_date DATE NOT NULL,
  weight_kg NUMERIC(5,2),
  height_cm NUMERIC(5,1),
  head_circumference_cm NUMERIC(4,1),
  bmi NUMERIC(4,2), -- Calculado automaticamente: weight / (height/100)^2
  
  -- Prematuridade
  is_premature BOOLEAN DEFAULT FALSE,
  gestational_age_weeks INTEGER, -- Idade gestacional ao nascer (se prematuro)
  
  -- Metadados
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by BIGINT
);

-- Adicionar foreign keys se não existirem
DO $$ 
BEGIN
  -- Foreign key para patients
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'anthropometry_entries_patient_id_fkey'
  ) THEN
    ALTER TABLE public.anthropometry_entries
    ADD CONSTRAINT anthropometry_entries_patient_id_fkey 
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
  END IF;

  -- Foreign key para appointments
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'anthropometry_entries_appointment_id_fkey'
  ) THEN
    ALTER TABLE public.anthropometry_entries
    ADD CONSTRAINT anthropometry_entries_appointment_id_fkey 
    FOREIGN KEY (appointment_id) REFERENCES appointments(id);
  END IF;

  -- Foreign key para medical_records
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'anthropometry_entries_medical_record_id_fkey'
  ) THEN
    ALTER TABLE public.anthropometry_entries
    ADD CONSTRAINT anthropometry_entries_medical_record_id_fkey 
    FOREIGN KEY (medical_record_id) REFERENCES medical_records(id);
  END IF;

  -- Foreign key para doctors
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'anthropometry_entries_created_by_fkey'
  ) THEN
    ALTER TABLE public.anthropometry_entries
    ADD CONSTRAINT anthropometry_entries_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES doctors(id);
  END IF;
END $$;

-- Índices para performance (IF NOT EXISTS já está implícito no CREATE INDEX IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_anthropometry_entries_patient_date ON public.anthropometry_entries(patient_id, measurement_date DESC);
CREATE INDEX IF NOT EXISTS idx_anthropometry_entries_appointment ON public.anthropometry_entries(appointment_id);
CREATE INDEX IF NOT EXISTS idx_anthropometry_entries_medical_record ON public.anthropometry_entries(medical_record_id);

-- Comentários para documentação
COMMENT ON TABLE public.anthropometry_entries IS 'Armazena histórico de medições antropométricas (peso, altura, perímetro cefálico, IMC) para pacientes pediátricos';
COMMENT ON COLUMN public.anthropometry_entries.bmi IS 'Índice de Massa Corporal calculado automaticamente: peso (kg) / (altura (m))^2';
COMMENT ON COLUMN public.anthropometry_entries.gestational_age_weeks IS 'Idade gestacional ao nascer em semanas (usado para calcular idade corrigida em prematuros)';
