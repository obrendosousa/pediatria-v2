-- Adicionar coluna patient_id na tabela sales (vínculo com paciente cadastrado no PDV/Loja)
-- Execute este script no SQL Editor do Supabase

ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS patient_id BIGINT REFERENCES patients(id) ON DELETE SET NULL;

-- Índice para consultas por paciente
CREATE INDEX IF NOT EXISTS idx_sales_patient_id ON public.sales(patient_id);

COMMENT ON COLUMN public.sales.patient_id IS 'ID do paciente vinculado à venda (opcional; consumidor final = null)';
