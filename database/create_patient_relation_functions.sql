-- Funções para gerenciar relacionamentos entre pacientes, telefones, appointments e chats
-- Execute este script no SQL Editor do Supabase

-- Função auxiliar para formatar telefone para exibição
CREATE OR REPLACE FUNCTION format_phone_display(p_phone TEXT)
RETURNS TEXT AS $$
BEGIN
  IF p_phone IS NULL OR length(p_phone) < 10 THEN
    RETURN p_phone;
  END IF;
  
  -- Formatar como (00) 00000-0000 ou (00) 0000-0000
  IF length(p_phone) = 11 THEN
    RETURN '(' || substring(p_phone, 1, 2) || ') ' || 
           substring(p_phone, 3, 5) || '-' || substring(p_phone, 8, 4);
  ELSIF length(p_phone) = 10 THEN
    RETURN '(' || substring(p_phone, 1, 2) || ') ' || 
           substring(p_phone, 3, 4) || '-' || substring(p_phone, 7, 4);
  END IF;
  
  RETURN p_phone;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função para buscar/criar vínculo por telefone
CREATE OR REPLACE FUNCTION link_patient_by_phone(
  p_phone TEXT,
  p_patient_id BIGINT DEFAULT NULL
) RETURNS BIGINT AS $$
DECLARE
  v_clean_phone TEXT;
  v_existing_patient_id BIGINT;
  v_phone_record_id BIGINT;
BEGIN
  -- Limpar telefone (remover tudo que não é número)
  v_clean_phone := regexp_replace(p_phone, '\D', '', 'g');
  
  IF v_clean_phone IS NULL OR length(v_clean_phone) < 10 THEN
    RETURN NULL;
  END IF;
  
  -- Se patient_id foi fornecido, adicionar número ao paciente
  IF p_patient_id IS NOT NULL THEN
    -- Verificar se já existe
    SELECT id INTO v_phone_record_id
    FROM public.patient_phones
    WHERE patient_id = p_patient_id AND phone = v_clean_phone;
    
    IF v_phone_record_id IS NULL THEN
      -- Adicionar número ao paciente
      INSERT INTO public.patient_phones (patient_id, phone, phone_formatted, is_primary, source)
      VALUES (p_patient_id, v_clean_phone, format_phone_display(v_clean_phone), false, 'manual')
      RETURNING id INTO v_phone_record_id;
    ELSE
      -- Atualizar para ativo se estava inativo
      UPDATE public.patient_phones
      SET is_active = true, updated_at = NOW()
      WHERE id = v_phone_record_id;
    END IF;
    
    RETURN p_patient_id;
  END IF;
  
  -- Buscar paciente existente pelo telefone
  SELECT patient_id INTO v_existing_patient_id
  FROM public.patient_phones
  WHERE phone = v_clean_phone AND is_active = true
  ORDER BY is_primary DESC, created_at DESC
  LIMIT 1;
  
  RETURN v_existing_patient_id;
END;
$$ LANGUAGE plpgsql;

-- Função para vincular appointment a paciente
CREATE OR REPLACE FUNCTION link_appointment_to_patient(p_appointment_id BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
  v_appointment RECORD;
  v_patient_id BIGINT;
BEGIN
  -- Buscar appointment
  SELECT id, patient_phone, patient_id INTO v_appointment
  FROM public.appointments
  WHERE id = p_appointment_id;
  
  IF v_appointment IS NULL THEN
    RETURN false;
  END IF;
  
  -- Se já tem patient_id, não fazer nada
  IF v_appointment.patient_id IS NOT NULL THEN
    RETURN true;
  END IF;
  
  -- Buscar paciente por telefone
  IF v_appointment.patient_phone IS NOT NULL THEN
    v_patient_id := link_patient_by_phone(v_appointment.patient_phone);
    
    IF v_patient_id IS NOT NULL THEN
      -- Atualizar appointment
      UPDATE public.appointments
      SET patient_id = v_patient_id
      WHERE id = p_appointment_id;
      
      RETURN true;
    END IF;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Função para vincular chat a paciente
CREATE OR REPLACE FUNCTION link_chat_to_patient(p_chat_id BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
  v_chat RECORD;
  v_patient_id BIGINT;
BEGIN
  -- Buscar chat
  SELECT id, phone, patient_id INTO v_chat
  FROM public.chats
  WHERE id = p_chat_id;
  
  IF v_chat IS NULL THEN
    RETURN false;
  END IF;
  
  -- Se já tem patient_id, não fazer nada
  IF v_chat.patient_id IS NOT NULL THEN
    RETURN true;
  END IF;
  
  -- Buscar paciente por telefone
  IF v_chat.phone IS NOT NULL THEN
    v_patient_id := link_patient_by_phone(v_chat.phone);
    
    IF v_patient_id IS NOT NULL THEN
      -- Atualizar chat
      UPDATE public.chats
      SET patient_id = v_patient_id
      WHERE id = p_chat_id;
      
      RETURN true;
    END IF;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Função para adicionar número a paciente
CREATE OR REPLACE FUNCTION add_phone_to_patient(
  p_patient_id BIGINT,
  p_phone TEXT,
  p_source TEXT DEFAULT 'manual',
  p_is_primary BOOLEAN DEFAULT false
) RETURNS BIGINT AS $$
DECLARE
  v_clean_phone TEXT;
  v_phone_id BIGINT;
BEGIN
  v_clean_phone := regexp_replace(p_phone, '\D', '', 'g');
  
  IF v_clean_phone IS NULL OR length(v_clean_phone) < 10 THEN
    RETURN NULL;
  END IF;
  
  -- Se for principal, desmarcar outros como principais
  IF p_is_primary THEN
    UPDATE public.patient_phones
    SET is_primary = false
    WHERE patient_id = p_patient_id;
  END IF;
  
  -- Inserir ou atualizar número
  INSERT INTO public.patient_phones (patient_id, phone, phone_formatted, is_primary, source, is_active)
  VALUES (p_patient_id, v_clean_phone, format_phone_display(v_clean_phone), p_is_primary, p_source, true)
  ON CONFLICT (patient_id, phone) 
  DO UPDATE SET 
    is_active = true,
    is_primary = p_is_primary,
    source = p_source,
    updated_at = NOW()
  RETURNING id INTO v_phone_id;
  
  RETURN v_phone_id;
END;
$$ LANGUAGE plpgsql;

-- Função para remover número de paciente (marcar como inativo)
CREATE OR REPLACE FUNCTION remove_phone_from_patient(
  p_patient_id BIGINT,
  p_phone TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_clean_phone TEXT;
BEGIN
  v_clean_phone := regexp_replace(p_phone, '\D', '', 'g');
  
  UPDATE public.patient_phones
  SET is_active = false, updated_at = NOW()
  WHERE patient_id = p_patient_id AND phone = v_clean_phone;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;
