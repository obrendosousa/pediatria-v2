-- Colunas de rastreio para métricas de CRM no schema atendimento.
-- Espelha as colunas já existentes em public.appointments.

ALTER TABLE atendimento.appointments
  ADD COLUMN IF NOT EXISTS queue_entered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS in_service_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_atendimento_appointments_queue_entered_at
  ON atendimento.appointments(queue_entered_at)
  WHERE queue_entered_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_atendimento_appointments_in_service_at
  ON atendimento.appointments(in_service_at)
  WHERE in_service_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_atendimento_appointments_finished_at
  ON atendimento.appointments(finished_at)
  WHERE finished_at IS NOT NULL;
