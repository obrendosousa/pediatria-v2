-- Script para documentar os status válidos da tabela appointments
-- O campo status já existe como TEXT, então apenas adicionamos comentários

-- Comentário na coluna status explicando os valores válidos
COMMENT ON COLUMN public.appointments.status IS 'Status do agendamento: 
- scheduled: Agendado (paciente ainda não chegou)
- waiting: Na sala de espera (check-in realizado)
- in_service: Em atendimento (dentro do consultório)
- finished: Finalizado (atendimento concluído)
- blocked: Horário bloqueado
- cancelled: Cancelado';

-- Exemplo de constraint check (opcional, pode ser adicionado se necessário)
-- ALTER TABLE public.appointments 
-- ADD CONSTRAINT check_status_valid 
-- CHECK (status IN ('scheduled', 'waiting', 'in_service', 'finished', 'blocked', 'cancelled'));
