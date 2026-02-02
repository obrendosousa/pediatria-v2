-- Tabela para armazenar regras de automação
CREATE TABLE IF NOT EXISTS public.automation_rules (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('milestone', 'appointment_reminder', 'return_reminder')),
    active BOOLEAN DEFAULT true,
    age_months INTEGER, -- Para tipo 'milestone'
    trigger_time TIME DEFAULT '08:00:00', -- Horário do disparo
    message_sequence JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array de mensagens
    variables_template JSONB DEFAULT '{}'::jsonb, -- Template com variáveis
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_automation_rules_type ON public.automation_rules(type);
CREATE INDEX IF NOT EXISTS idx_automation_rules_active ON public.automation_rules(active);
CREATE INDEX IF NOT EXISTS idx_automation_rules_age_months ON public.automation_rules(age_months) WHERE age_months IS NOT NULL;

-- Tabela para logs de execução das automações
CREATE TABLE IF NOT EXISTS public.automation_logs (
    id BIGSERIAL PRIMARY KEY,
    automation_rule_id BIGINT REFERENCES public.automation_rules(id) ON DELETE CASCADE,
    patient_id BIGINT REFERENCES public.patients(id) ON DELETE CASCADE,
    appointment_id BIGINT REFERENCES public.appointments(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para logs
CREATE INDEX IF NOT EXISTS idx_automation_logs_rule_id ON public.automation_logs(automation_rule_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_patient_id ON public.automation_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_status ON public.automation_logs(status);
CREATE INDEX IF NOT EXISTS idx_automation_logs_sent_at ON public.automation_logs(sent_at);

-- Tabela para histórico de envios (evitar duplicatas)
CREATE TABLE IF NOT EXISTS public.automation_sent_history (
    id BIGSERIAL PRIMARY KEY,
    automation_rule_id BIGINT REFERENCES public.automation_rules(id) ON DELETE CASCADE,
    patient_id BIGINT REFERENCES public.patients(id) ON DELETE CASCADE,
    milestone_age INTEGER, -- Para rastrear qual marco foi enviado
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(automation_rule_id, patient_id, milestone_age)
);

-- Índices para histórico
CREATE INDEX IF NOT EXISTS idx_automation_sent_history_rule_id ON public.automation_sent_history(automation_rule_id);
CREATE INDEX IF NOT EXISTS idx_automation_sent_history_patient_id ON public.automation_sent_history(patient_id);
CREATE INDEX IF NOT EXISTS idx_automation_sent_history_milestone ON public.automation_sent_history(milestone_age) WHERE milestone_age IS NOT NULL;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_automation_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_automation_rules_updated_at
    BEFORE UPDATE ON public.automation_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_automation_rules_updated_at();

-- RLS (Row Level Security) - Permitir acesso para usuários autenticados
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_sent_history ENABLE ROW LEVEL SECURITY;

-- Políticas básicas (ajustar conforme necessário)
CREATE POLICY "Allow all for authenticated users" ON public.automation_rules
    FOR ALL USING (true);

CREATE POLICY "Allow all for authenticated users" ON public.automation_logs
    FOR ALL USING (true);

CREATE POLICY "Allow all for authenticated users" ON public.automation_sent_history
    FOR ALL USING (true);

-- Adicionar campo automation_rule_id em scheduled_messages se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'scheduled_messages' 
        AND column_name = 'automation_rule_id'
    ) THEN
        ALTER TABLE public.scheduled_messages 
        ADD COLUMN automation_rule_id BIGINT REFERENCES public.automation_rules(id) ON DELETE SET NULL;
        
        CREATE INDEX IF NOT EXISTS idx_scheduled_messages_automation_rule_id 
        ON public.scheduled_messages(automation_rule_id);
    END IF;
END $$;
