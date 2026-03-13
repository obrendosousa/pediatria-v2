-- Alinhamento de status e campos de agendamento com o PRD Support Clinic v2.13.68
-- Seção 6 (Agenda) e 6.2.1 (Visualizar Agendamento)
-- Schema: atendimento
--
-- Status existentes: scheduled, called, waiting, in_service, waiting_payment, finished, blocked, cancelled, no_show
-- Novos status: confirmed, late, unmarked, rescheduled, not_attended
--
-- JÁ APLICADO VIA MCP em 2026-03-12

-- ============================================================
-- 1. Atualizar COMMENT com todos os status válidos
-- ============================================================
COMMENT ON COLUMN atendimento.appointments.status IS 'Status do agendamento:
- scheduled: Agendado (paciente ainda não chegou)
- confirmed: Confirmado (paciente confirmou presença)
- waiting: Sala de espera (check-in realizado)
- called: Chamado (paciente foi chamado)
- in_service: Em atendimento (dentro do consultório)
- waiting_payment: Aguardando pagamento
- finished: Atendido (atendimento concluído)
- late: Atrasado (paciente em atraso)
- no_show: Faltou (paciente não compareceu)
- cancelled: Cancelado
- unmarked: Desmarcado (paciente desmarcou)
- not_attended: Não atendido
- rescheduled: Reagendado para outra data
- blocked: Horário bloqueado';

-- ============================================================
-- 2. CHECK constraint com todos os status válidos
-- ============================================================
ALTER TABLE atendimento.appointments
  DROP CONSTRAINT IF EXISTS check_appointment_status;

ALTER TABLE atendimento.appointments
  ADD CONSTRAINT check_appointment_status
  CHECK (status IN (
    'scheduled', 'confirmed', 'waiting', 'called',
    'in_service', 'waiting_payment', 'finished',
    'late', 'no_show', 'cancelled', 'unmarked',
    'not_attended', 'rescheduled', 'blocked'
  ));

-- ============================================================
-- 3. Novos campos na tabela appointments
-- ============================================================
ALTER TABLE atendimento.appointments
  ADD COLUMN IF NOT EXISTS appointment_subtype TEXT,
  ADD COLUMN IF NOT EXISTS procedures TEXT[],
  ADD COLUMN IF NOT EXISTS send_anamnesis BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_squeeze BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_teleconsultation BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_confirm BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS generate_budget BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_by TEXT,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rescheduled_from BIGINT REFERENCES atendimento.appointments(id);

-- Constraint para appointment_subtype
ALTER TABLE atendimento.appointments
  DROP CONSTRAINT IF EXISTS check_appointment_subtype;

ALTER TABLE atendimento.appointments
  ADD CONSTRAINT check_appointment_subtype
  CHECK (appointment_subtype IS NULL OR appointment_subtype IN ('orcamento', 'simples'));

-- Comentários
COMMENT ON COLUMN atendimento.appointments.appointment_subtype IS 'Subtipo: orcamento ou simples';
COMMENT ON COLUMN atendimento.appointments.procedures IS 'Array de procedimentos associados ao agendamento';
COMMENT ON COLUMN atendimento.appointments.send_anamnesis IS 'Se deve enviar anamnese ao paciente';
COMMENT ON COLUMN atendimento.appointments.is_squeeze IS 'Encaixe de horário (ignora conflito)';
COMMENT ON COLUMN atendimento.appointments.is_teleconsultation IS 'Teleconsulta';
COMMENT ON COLUMN atendimento.appointments.auto_confirm IS 'Agendar já como confirmado';
COMMENT ON COLUMN atendimento.appointments.generate_budget IS 'Gerar orçamento automaticamente ao salvar';
COMMENT ON COLUMN atendimento.appointments.description IS 'Observações / notas do agendamento';
COMMENT ON COLUMN atendimento.appointments.scheduled_by IS 'Responsável pelo agendamento';
COMMENT ON COLUMN atendimento.appointments.confirmed_at IS 'Timestamp de confirmação de presença';
COMMENT ON COLUMN atendimento.appointments.cancelled_at IS 'Timestamp de cancelamento';
COMMENT ON COLUMN atendimento.appointments.rescheduled_from IS 'ID do agendamento original (quando reagendado)';

-- Índices
CREATE INDEX IF NOT EXISTS idx_appt_subtype
  ON atendimento.appointments(appointment_subtype)
  WHERE appointment_subtype IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appt_rescheduled_from
  ON atendimento.appointments(rescheduled_from)
  WHERE rescheduled_from IS NOT NULL;

-- ============================================================
-- 4. Tabela de audit trail: appointment_status_log
-- ============================================================
CREATE TABLE IF NOT EXISTS atendimento.appointment_status_log (
  id BIGSERIAL PRIMARY KEY,
  appointment_id BIGINT NOT NULL REFERENCES atendimento.appointments(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);

COMMENT ON TABLE atendimento.appointment_status_log IS 'Log de auditoria de mudanças de status dos agendamentos (seção 6.2.1 PRD)';

CREATE INDEX IF NOT EXISTS idx_status_log_appointment_id
  ON atendimento.appointment_status_log(appointment_id);

CREATE INDEX IF NOT EXISTS idx_status_log_changed_at
  ON atendimento.appointment_status_log(changed_at);

-- ============================================================
-- 5. RLS para appointment_status_log
-- ============================================================
ALTER TABLE atendimento.appointment_status_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users full access" ON atendimento.appointment_status_log
  FOR ALL
  USING (public.current_user_has_approved_profile())
  WITH CHECK (public.current_user_has_approved_profile());
