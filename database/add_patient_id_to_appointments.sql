-- Adicionar coluna patient_id na tabela appointments
-- Execute este script no SQL Editor do Supabase

ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS patient_id BIGINT REFERENCES patients(id) ON DELETE SET NULL;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON public.appointments(patient_id);

-- Comentário para documentação
COMMENT ON COLUMN public.appointments.patient_id IS 'ID do paciente vinculado ao agendamento (FK para patients)';
