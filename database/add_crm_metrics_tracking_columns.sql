-- Colunas de rastreio para métricas precisas de CRM.
-- Objetivo: eliminar aproximações e permitir cálculo auditável de fila, atendimento e conversão.

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS queue_entered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS in_service_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS chat_id BIGINT REFERENCES public.chats(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_queue_entered_at
  ON public.appointments(queue_entered_at)
  WHERE queue_entered_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_in_service_at
  ON public.appointments(in_service_at)
  WHERE in_service_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_finished_at
  ON public.appointments(finished_at)
  WHERE finished_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_chat_id
  ON public.appointments(chat_id)
  WHERE chat_id IS NOT NULL;

COMMENT ON COLUMN public.appointments.queue_entered_at IS
  'Timestamp de entrada na fila (status waiting). Base oficial para tempo de fila.';

COMMENT ON COLUMN public.appointments.in_service_at IS
  'Timestamp de inicio do atendimento (status in_service).';

COMMENT ON COLUMN public.appointments.finished_at IS
  'Timestamp de finalizacao do atendimento (status finished).';

COMMENT ON COLUMN public.appointments.chat_id IS
  'Chat de origem vinculado ao agendamento para metricas de conversao e retorno.';
