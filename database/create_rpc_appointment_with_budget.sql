-- RPC: Cria appointment + budget + budget_items em uma única transação atômica.
-- Se qualquer parte falhar, tudo faz rollback automaticamente.

CREATE OR REPLACE FUNCTION atendimento.create_appointment_with_budget(
  p_appointment JSONB,
  p_budget JSONB DEFAULT NULL,
  p_budget_items JSONB DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_appointment_id BIGINT;
  v_budget_id BIGINT;
BEGIN
  -- 1. Insert appointment
  INSERT INTO atendimento.appointments (
    patient_id, doctor_id, date, time, end_time, status,
    appointment_subtype, procedures, send_anamnesis, is_squeeze,
    is_teleconsultation, auto_confirm, generate_budget,
    description, notes, scheduled_by
  ) VALUES (
    (p_appointment->>'patient_id')::BIGINT,
    (p_appointment->>'doctor_id')::BIGINT,
    (p_appointment->>'date')::DATE,
    (p_appointment->>'time')::TIME,
    NULLIF(p_appointment->>'end_time', '')::TIME,
    COALESCE(p_appointment->>'status', 'scheduled'),
    p_appointment->>'appointment_subtype',
    CASE
      WHEN p_appointment->'procedures' IS NOT NULL AND jsonb_typeof(p_appointment->'procedures') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(p_appointment->'procedures'))
      ELSE NULL
    END,
    COALESCE((p_appointment->>'send_anamnesis')::BOOLEAN, false),
    COALESCE((p_appointment->>'is_squeeze')::BOOLEAN, false),
    COALESCE((p_appointment->>'is_teleconsultation')::BOOLEAN, false),
    COALESCE((p_appointment->>'auto_confirm')::BOOLEAN, false),
    COALESCE((p_appointment->>'generate_budget')::BOOLEAN, false),
    NULLIF(p_appointment->>'description', ''),
    NULLIF(p_appointment->>'notes', ''),
    p_appointment->>'scheduled_by'
  ) RETURNING id INTO v_appointment_id;

  -- 2. Se budget solicitado, inserir budget na mesma transação
  IF p_budget IS NOT NULL THEN
    INSERT INTO atendimento.budgets (
      patient_id, doctor_id, subtotal, discount_type,
      discount_value, discount_amount, total, installments,
      notes, status
    ) VALUES (
      (p_budget->>'patient_id')::BIGINT,
      (p_budget->>'doctor_id')::BIGINT,
      (p_budget->>'subtotal')::NUMERIC,
      COALESCE(p_budget->>'discount_type', '%'),
      COALESCE((p_budget->>'discount_value')::NUMERIC, 0),
      COALESCE((p_budget->>'discount_amount')::NUMERIC, 0),
      (p_budget->>'total')::NUMERIC,
      COALESCE((p_budget->>'installments')::INTEGER, 1),
      p_budget->>'notes',
      COALESCE(p_budget->>'status', 'pendente')
    ) RETURNING id INTO v_budget_id;

    -- 3. Inserir budget_items
    IF p_budget_items IS NOT NULL AND jsonb_typeof(p_budget_items) = 'array' THEN
      INSERT INTO atendimento.budget_items (
        budget_id, procedure_name, sessions, unit_price, subtotal
      )
      SELECT
        v_budget_id,
        item->>'procedure_name',
        COALESCE((item->>'sessions')::INTEGER, 1),
        (item->>'unit_price')::NUMERIC,
        (item->>'subtotal')::NUMERIC
      FROM jsonb_array_elements(p_budget_items) AS item;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'appointment_id', v_appointment_id,
    'budget_id', v_budget_id
  );
END;
$$;

-- Permissões
GRANT EXECUTE ON FUNCTION atendimento.create_appointment_with_budget(JSONB, JSONB, JSONB) TO authenticated;
