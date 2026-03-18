-- RPC: Finaliza consulta em uma única transação atômica.
-- Cria checkout + items + retorno + atualiza appointment + assina prontuário + atualiza chat.
-- Se qualquer parte falhar, tudo faz rollback automaticamente.

CREATE OR REPLACE FUNCTION public.finish_consultation(p_params JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_patient_id BIGINT := (p_params->>'patient_id')::BIGINT;
  v_appointment_id BIGINT := (p_params->>'appointment_id')::BIGINT;
  v_chat_id TEXT := p_params->>'chat_id';
  v_notes TEXT := p_params->>'notes';
  v_return_date TEXT := p_params->>'return_date';
  v_return_obs TEXT := p_params->>'return_obs';
  v_products JSONB := p_params->'products';
  v_checkout_id BIGINT;
  v_return_appointment_id BIGINT;
  v_medical_record_id BIGINT;
  v_has_products BOOLEAN;
  v_has_return BOOLEAN;
  v_has_notes BOOLEAN;
  v_secretary_notes TEXT;
  v_current_apt RECORD;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  v_has_products := v_products IS NOT NULL AND jsonb_typeof(v_products) = 'array' AND jsonb_array_length(v_products) > 0;
  v_has_return := v_return_date IS NOT NULL AND v_return_date <> '';
  v_has_notes := v_notes IS NOT NULL AND v_notes <> '';

  -- 1. Criar medical_checkout se necessário
  IF v_has_products OR v_has_return OR v_has_notes THEN
    v_secretary_notes := NULLIF(
      CONCAT_WS(' • ',
        NULLIF(v_notes, ''),
        CASE WHEN v_return_obs IS NOT NULL AND v_return_obs <> '' THEN 'Retorno: ' || v_return_obs ELSE NULL END
      ), ''
    );

    INSERT INTO public.medical_checkouts (
      secretary_notes, status, patient_id, appointment_id, chat_id, return_date, return_obs
    ) VALUES (
      v_secretary_notes,
      'pending',
      v_patient_id,
      v_appointment_id,
      NULLIF(v_chat_id, '')::BIGINT,
      NULLIF(v_return_date, '')::DATE,
      NULLIF(v_return_obs, '')
    ) RETURNING id INTO v_checkout_id;

    -- 2. Inserir checkout items (produtos)
    IF v_has_products AND v_checkout_id IS NOT NULL THEN
      INSERT INTO public.checkout_items (checkout_id, product_id, quantity, type)
      SELECT
        v_checkout_id,
        (item->>'product_id')::BIGINT,
        (item->>'quantity')::INTEGER,
        'product'
      FROM jsonb_array_elements(v_products) AS item;
    END IF;
  END IF;

  -- 3. Criar retorno se necessário
  IF v_has_return AND v_appointment_id IS NOT NULL THEN
    SELECT doctor_id, doctor_name, patient_name, patient_phone
    INTO v_current_apt
    FROM public.appointments
    WHERE id = v_appointment_id;

    IF v_current_apt.doctor_id IS NOT NULL THEN
      INSERT INTO public.appointments (
        doctor_id, doctor_name, patient_name, patient_phone,
        patient_id, start_time, status, appointment_type, notes
      ) VALUES (
        v_current_apt.doctor_id,
        v_current_apt.doctor_name,
        v_current_apt.patient_name,
        v_current_apt.patient_phone,
        v_patient_id,
        (v_return_date || 'T09:00:00')::TIMESTAMPTZ,
        'scheduled',
        'retorno',
        COALESCE(NULLIF(v_return_obs, ''), 'Retorno agendado na consulta de ' || TO_CHAR(v_now, 'DD/MM/YYYY'))
      ) RETURNING id INTO v_return_appointment_id;
    END IF;
  END IF;

  -- 4. Atualizar status do appointment para 'waiting_payment'
  IF v_appointment_id IS NOT NULL THEN
    UPDATE public.appointments
    SET status = 'waiting_payment', finished_at = v_now
    WHERE id = v_appointment_id;
  END IF;

  -- 5. Assinar prontuário (medical_records mais recente em draft)
  UPDATE public.medical_records
  SET status = 'signed', finished_at = v_now
  WHERE id = (
    SELECT id FROM public.medical_records
    WHERE patient_id = v_patient_id AND status = 'draft'
    ORDER BY created_at DESC
    LIMIT 1
  )
  RETURNING id INTO v_medical_record_id;

  -- 6. Atualizar chat (non-critical, dentro da transação)
  IF v_chat_id IS NOT NULL AND v_chat_id <> '' THEN
    UPDATE public.chats
    SET last_interaction_at = v_now
    WHERE id = v_chat_id::BIGINT;
  END IF;

  RETURN jsonb_build_object(
    'checkout_id', v_checkout_id,
    'return_appointment_id', v_return_appointment_id,
    'medical_record_id', v_medical_record_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.finish_consultation(JSONB) TO authenticated;
