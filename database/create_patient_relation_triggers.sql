-- Triggers para sincronização automática entre patients, appointments e chats
-- Execute este script no SQL Editor do Supabase

-- Função para sincronizar appointment ao criar paciente
CREATE OR REPLACE FUNCTION sync_appointment_patient_id()
RETURNS TRIGGER AS $$
DECLARE
  v_clean_phone TEXT;
  v_phone_record_id BIGINT;
BEGIN
  -- Se o paciente tem telefone, adicionar à tabela patient_phones
  IF NEW.phone IS NOT NULL THEN
    v_clean_phone := regexp_replace(NEW.phone, '\D', '', 'g');
    
    -- Adicionar número principal
    INSERT INTO public.patient_phones (patient_id, phone, phone_formatted, is_primary, source, is_active)
    VALUES (NEW.id, v_clean_phone, format_phone_display(v_clean_phone), true, 'patient_creation', true)
    ON CONFLICT (patient_id, phone) 
    DO UPDATE SET is_active = true, is_primary = true, updated_at = NOW();
    
    -- Buscar appointments pendentes e vincular
    UPDATE public.appointments
    SET patient_id = NEW.id
    WHERE regexp_replace(patient_phone, '\D', '', 'g') = v_clean_phone
      AND patient_id IS NULL
      AND status IN ('scheduled', 'called', 'waiting', 'in_service');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para sincronizar appointment ao criar paciente
DROP TRIGGER IF EXISTS trigger_sync_appointment_on_patient_create ON public.patients;
CREATE TRIGGER trigger_sync_appointment_on_patient_create
AFTER INSERT ON public.patients
FOR EACH ROW
EXECUTE FUNCTION sync_appointment_patient_id();

-- Função para sincronizar chat ao criar paciente
CREATE OR REPLACE FUNCTION sync_chat_patient_id()
RETURNS TRIGGER AS $$
DECLARE
  v_clean_phone TEXT;
BEGIN
  -- Se o paciente tem telefone, buscar chats e vincular
  IF NEW.phone IS NOT NULL THEN
    v_clean_phone := regexp_replace(NEW.phone, '\D', '', 'g');
    
    UPDATE public.chats
    SET patient_id = NEW.id
    WHERE regexp_replace(phone, '\D', '', 'g') = v_clean_phone
      AND patient_id IS NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para sincronizar chat ao criar paciente
DROP TRIGGER IF EXISTS trigger_sync_chat_on_patient_create ON public.patients;
CREATE TRIGGER trigger_sync_chat_on_patient_create
AFTER INSERT ON public.patients
FOR EACH ROW
EXECUTE FUNCTION sync_chat_patient_id();

-- Função para vincular appointment automaticamente ao criar/atualizar
CREATE OR REPLACE FUNCTION link_appointment_to_patient_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_patient_id BIGINT;
BEGIN
  -- Se já tem patient_id, não fazer nada
  IF NEW.patient_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  -- Buscar paciente por telefone
  IF NEW.patient_phone IS NOT NULL THEN
    v_patient_id := link_patient_by_phone(NEW.patient_phone);
    
    IF v_patient_id IS NOT NULL THEN
      NEW.patient_id := v_patient_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para vincular appointment automaticamente
DROP TRIGGER IF EXISTS trigger_link_appointment_to_patient ON public.appointments;
CREATE TRIGGER trigger_link_appointment_to_patient
BEFORE INSERT OR UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION link_appointment_to_patient_trigger();

-- Função para vincular chat automaticamente ao criar/atualizar
CREATE OR REPLACE FUNCTION link_chat_to_patient_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_patient_id BIGINT;
BEGIN
  -- Se já tem patient_id, não fazer nada
  IF NEW.patient_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  -- Buscar paciente por telefone
  IF NEW.phone IS NOT NULL THEN
    v_patient_id := link_patient_by_phone(NEW.phone);
    
    IF v_patient_id IS NOT NULL THEN
      NEW.patient_id := v_patient_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para vincular chat automaticamente
DROP TRIGGER IF EXISTS trigger_link_chat_to_patient ON public.chats;
CREATE TRIGGER trigger_link_chat_to_patient
BEFORE INSERT OR UPDATE ON public.chats
FOR EACH ROW
EXECUTE FUNCTION link_chat_to_patient_trigger();
