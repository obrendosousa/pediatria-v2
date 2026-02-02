-- Script para adicionar campos necessários na tabela medical_checkouts
-- Execute este script no SQL Editor do Supabase

-- Adicionar campo consultation_value (valor da consulta)
ALTER TABLE public.medical_checkouts
ADD COLUMN IF NOT EXISTS consultation_value NUMERIC(10, 2) NULL;

COMMENT ON COLUMN public.medical_checkouts.consultation_value IS 'Valor da consulta médica em reais';

-- Adicionar campo patient_id (se não existir)
ALTER TABLE public.medical_checkouts
ADD COLUMN IF NOT EXISTS patient_id BIGINT NULL;

COMMENT ON COLUMN public.medical_checkouts.patient_id IS 'ID do paciente vinculado ao checkout (FK para patients)';

-- Adicionar campo appointment_id (se não existir)
ALTER TABLE public.medical_checkouts
ADD COLUMN IF NOT EXISTS appointment_id BIGINT NULL;

COMMENT ON COLUMN public.medical_checkouts.appointment_id IS 'ID do agendamento vinculado ao checkout (FK para appointments)';

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_medical_checkouts_patient_id 
ON public.medical_checkouts(patient_id);

CREATE INDEX IF NOT EXISTS idx_medical_checkouts_appointment_id 
ON public.medical_checkouts(appointment_id);

-- Adicionar foreign keys se as colunas foram criadas
DO $$
BEGIN
  -- Verificar se patient_id existe e adicionar FK
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'medical_checkouts' 
    AND column_name = 'patient_id'
  ) THEN
    -- Remover constraint se existir
    ALTER TABLE public.medical_checkouts
    DROP CONSTRAINT IF EXISTS medical_checkouts_patient_id_fkey;
    
    -- Adicionar constraint
    ALTER TABLE public.medical_checkouts
    ADD CONSTRAINT medical_checkouts_patient_id_fkey 
    FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE SET NULL;
  END IF;

  -- Verificar se appointment_id existe e adicionar FK
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'medical_checkouts' 
    AND column_name = 'appointment_id'
  ) THEN
    -- Remover constraint se existir
    ALTER TABLE public.medical_checkouts
    DROP CONSTRAINT IF EXISTS medical_checkouts_appointment_id_fkey;
    
    -- Adicionar constraint
    ALTER TABLE public.medical_checkouts
    ADD CONSTRAINT medical_checkouts_appointment_id_fkey 
    FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Verificar se as colunas foram criadas
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'medical_checkouts'
AND column_name IN ('consultation_value', 'patient_id', 'appointment_id');
