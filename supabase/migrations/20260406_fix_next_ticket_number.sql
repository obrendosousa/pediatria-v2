-- Fix: drop the 2-parameter overload that causes ambiguity
-- and fix date comparison (ticket_date is type date, not text)

DROP FUNCTION IF EXISTS atendimento.next_ticket_number(text, date);
DROP FUNCTION IF EXISTS atendimento.next_ticket_number(text);

CREATE OR REPLACE FUNCTION atendimento.next_ticket_number(p_prefix text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today date := CURRENT_DATE;
  v_next int;
BEGIN
  SELECT COUNT(*) + 1 INTO v_next
  FROM atendimento.queue_tickets
  WHERE ticket_date = v_today
    AND ticket_number LIKE p_prefix || '%';

  RETURN p_prefix || LPAD(v_next::text, 3, '0');
END;
$$;
