-- Previne double-booking no nível do banco de dados.
-- A validação na aplicação (checkTimeConflict) continua como fast-path otimista,
-- mas esta constraint garante integridade mesmo sob requests concorrentes.

-- Schema atendimento: usa colunas separadas date + time
CREATE UNIQUE INDEX IF NOT EXISTS idx_atendimento_appointments_no_double_book
ON atendimento.appointments (doctor_id, date, time)
WHERE status NOT IN ('cancelled', 'rescheduled', 'unmarked');

-- Schema public: usa coluna start_time (timestamptz)
CREATE UNIQUE INDEX IF NOT EXISTS idx_public_appointments_no_double_book
ON public.appointments (doctor_id, start_time)
WHERE status NOT IN ('cancelled', 'rescheduled', 'unmarked');
