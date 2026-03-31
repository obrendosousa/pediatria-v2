-- Migration: Suporte cross-schema para filas (pediatria + atendimento)

-- 1) Adicionar source_schema em queue_tickets do atendimento
-- Para saber se o ticket veio de public (pediatria) ou atendimento
ALTER TABLE atendimento.queue_tickets
  ADD COLUMN IF NOT EXISTS source_schema text NOT NULL DEFAULT 'atendimento';

COMMENT ON COLUMN atendimento.queue_tickets.source_schema IS
  'Schema de origem do appointment: public (pediatria) ou atendimento';

-- 2) Adicionar queue_stage e current_ticket_id em public.appointments (pediatria)
-- Para que pacientes da pediatria possam participar do fluxo de filas
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS queue_stage text CHECK (queue_stage IN ('reception', 'doctor')),
  ADD COLUMN IF NOT EXISTS current_ticket_id integer;

COMMENT ON COLUMN public.appointments.queue_stage IS
  'Estágio da fila: reception (guichê) ou doctor (consultório)';
COMMENT ON COLUMN public.appointments.current_ticket_id IS
  'ID do ticket ativo no atendimento.queue_tickets';
