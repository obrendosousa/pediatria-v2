-- Criar tabela patient_phones para permitir múltiplos números por paciente
-- Execute este script no SQL Editor do Supabase

CREATE TABLE IF NOT EXISTS public.patient_phones (
  id BIGSERIAL PRIMARY KEY,
  patient_id BIGINT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  phone TEXT NOT NULL, -- Telefone limpo (apenas números)
  phone_formatted TEXT, -- Telefone formatado para exibição
  is_primary BOOLEAN DEFAULT false, -- Número principal
  is_active BOOLEAN DEFAULT true, -- Número ativo
  source TEXT, -- 'chat', 'appointment', 'manual', 'migration', etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_patient_phone UNIQUE(patient_id, phone) -- Um paciente não pode ter o mesmo número duplicado
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_patient_phones_patient_id ON public.patient_phones(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_phones_phone ON public.patient_phones(phone);
CREATE INDEX IF NOT EXISTS idx_patient_phones_active ON public.patient_phones(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_patient_phones_primary ON public.patient_phones(patient_id, is_primary) WHERE is_primary = true;

-- Comentários para documentação
COMMENT ON TABLE public.patient_phones IS 'Tabela para armazenar múltiplos números de telefone por paciente';
COMMENT ON COLUMN public.patient_phones.phone IS 'Telefone limpo (apenas números)';
COMMENT ON COLUMN public.patient_phones.phone_formatted IS 'Telefone formatado para exibição (ex: (99) 99999-9999)';
COMMENT ON COLUMN public.patient_phones.is_primary IS 'Indica se é o número principal do paciente';
COMMENT ON COLUMN public.patient_phones.is_active IS 'Indica se o número está ativo';
COMMENT ON COLUMN public.patient_phones.source IS 'Origem do número: chat, appointment, manual, migration, etc.';
