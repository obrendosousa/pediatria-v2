-- Migration: Totem de Senhas (Kiosk) — suporte a tickets sem agendamento

-- 1) Tornar appointment_id nullable (kiosk gera ticket sem appointment)
ALTER TABLE atendimento.queue_tickets
  ALTER COLUMN appointment_id DROP NOT NULL;

-- 2) Adicionar coluna kiosk_category para categorias do totem
ALTER TABLE atendimento.queue_tickets
  ADD COLUMN IF NOT EXISTS kiosk_category text;

COMMENT ON COLUMN atendimento.queue_tickets.kiosk_category IS
  'Categoria do totem: normal, prioridade, laboratorio, laboratorio_prioridade';

-- 3) Atualizar RPC next_ticket_number para aceitar novos prefixos (N, L, LP)
-- A função já existe e suporta prefixos dinâmicos (G, C, P).
-- Vamos recriar com suporte a qualquer prefixo (genérica).
CREATE OR REPLACE FUNCTION atendimento.next_ticket_number(p_prefix text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today date := CURRENT_DATE;
  v_next int;
BEGIN
  -- Contar quantos tickets com este prefixo já existem hoje
  SELECT COUNT(*) + 1 INTO v_next
  FROM atendimento.queue_tickets
  WHERE ticket_date = v_today::text
    AND ticket_number LIKE p_prefix || '%';

  -- Retornar prefixo + número com 3 dígitos (ex: N001, P002, L003, LP001)
  RETURN p_prefix || LPAD(v_next::text, 3, '0');
END;
$$;

COMMENT ON FUNCTION atendimento.next_ticket_number(text) IS
  'Gera próximo número de senha do dia para o prefixo dado (N, P, L, LP, G, C)';
