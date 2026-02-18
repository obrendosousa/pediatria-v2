-- Tipo de atendimento para classificar consulta x retorno.
-- Sem backfill automático: registros antigos permanecem nulos.

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS appointment_type TEXT;

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_appointment_type_check;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_appointment_type_check
  CHECK (
    appointment_type IS NULL
    OR appointment_type IN ('consulta', 'retorno')
  );

COMMENT ON COLUMN public.appointments.appointment_type IS
  'Tipo do atendimento: consulta ou retorno (obrigatório para novos agendamentos via aplicação).';
