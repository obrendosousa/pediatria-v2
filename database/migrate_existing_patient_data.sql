-- Script de migração para dados existentes
-- Execute este script APÓS criar as tabelas e funções
-- ATENÇÃO: Faça backup antes de executar!

BEGIN;

-- 1. Migrar phones de patients para patient_phones
INSERT INTO public.patient_phones (patient_id, phone, phone_formatted, is_primary, source, is_active)
SELECT 
  id,
  regexp_replace(phone, '\D', '', 'g') as phone,
  phone as phone_formatted,
  true as is_primary,
  'migration' as source,
  true as is_active
FROM public.patients
WHERE phone IS NOT NULL
  AND regexp_replace(phone, '\D', '', 'g') != ''
ON CONFLICT (patient_id, phone) DO NOTHING;

-- 2. Vincular appointments a patients por telefone
UPDATE public.appointments a
SET patient_id = p.id
FROM public.patients p
WHERE regexp_replace(a.patient_phone, '\D', '', 'g') = regexp_replace(p.phone, '\D', '', 'g')
  AND a.patient_id IS NULL
  AND a.patient_phone IS NOT NULL
  AND p.phone IS NOT NULL;

-- 3. Vincular chats a patients por telefone
UPDATE public.chats c
SET patient_id = p.id
FROM public.patients p
WHERE regexp_replace(c.phone, '\D', '', 'g') = regexp_replace(p.phone, '\D', '', 'g')
  AND c.patient_id IS NULL
  AND c.phone IS NOT NULL
  AND p.phone IS NOT NULL;

-- 4. Adicionar números de appointments à tabela patient_phones (se o appointment já está vinculado)
INSERT INTO public.patient_phones (patient_id, phone, phone_formatted, is_primary, source, is_active)
SELECT DISTINCT
  a.patient_id,
  regexp_replace(a.patient_phone, '\D', '', 'g') as phone,
  a.patient_phone as phone_formatted,
  false as is_primary,
  'appointment' as source,
  true as is_active
FROM public.appointments a
WHERE a.patient_id IS NOT NULL
  AND a.patient_phone IS NOT NULL
  AND regexp_replace(a.patient_phone, '\D', '', 'g') != ''
  AND NOT EXISTS (
    SELECT 1 FROM public.patient_phones pp
    WHERE pp.patient_id = a.patient_id
      AND pp.phone = regexp_replace(a.patient_phone, '\D', '', 'g')
  )
ON CONFLICT (patient_id, phone) DO NOTHING;

-- 5. Adicionar números de chats à tabela patient_phones (se o chat já está vinculado)
INSERT INTO public.patient_phones (patient_id, phone, phone_formatted, is_primary, source, is_active)
SELECT DISTINCT
  c.patient_id,
  regexp_replace(c.phone, '\D', '', 'g') as phone,
  c.phone as phone_formatted,
  false as is_primary,
  'chat' as source,
  true as is_active
FROM public.chats c
WHERE c.patient_id IS NOT NULL
  AND c.phone IS NOT NULL
  AND regexp_replace(c.phone, '\D', '', 'g') != ''
  AND NOT EXISTS (
    SELECT 1 FROM public.patient_phones pp
    WHERE pp.patient_id = c.patient_id
      AND pp.phone = regexp_replace(c.phone, '\D', '', 'g')
  )
ON CONFLICT (patient_id, phone) DO NOTHING;

COMMIT;

-- Verificar resultados
SELECT 
  'Pacientes com números migrados' as descricao,
  COUNT(DISTINCT patient_id) as total
FROM public.patient_phones;

SELECT 
  'Appointments vinculados' as descricao,
  COUNT(*) as total
FROM public.appointments
WHERE patient_id IS NOT NULL;

SELECT 
  'Chats vinculados' as descricao,
  COUNT(*) as total
FROM public.chats
WHERE patient_id IS NOT NULL;
