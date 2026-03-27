-- Migração: Unificar sistema de responsáveis/familiares
-- Garante que family_members JSONB é a fonte principal de dados,
-- migrando dados legados de colunas flat (mother_name, father_name, etc.)

-- ════════════════════════════════════════════════════════════════
-- 1. public.patients — Migrar mother_name/father_name → family_members
-- ════════════════════════════════════════════════════════════════

UPDATE public.patients
SET family_members = (
  SELECT jsonb_agg(member)
  FROM (
    SELECT jsonb_build_object(
      'name', mother_name,
      'relationship', 'Mãe'
    ) AS member
    WHERE mother_name IS NOT NULL AND mother_name != ''
    UNION ALL
    SELECT jsonb_build_object(
      'name', father_name,
      'relationship', 'Pai'
    ) AS member
    WHERE father_name IS NOT NULL AND father_name != ''
  ) sub
)
WHERE (family_members IS NULL OR family_members = '[]'::jsonb)
  AND (
    (mother_name IS NOT NULL AND mother_name != '')
    OR (father_name IS NOT NULL AND father_name != '')
  );

-- ════════════════════════════════════════════════════════════════
-- 2. atendimento.patients — Adicionar coluna family_members se não existe
-- ════════════════════════════════════════════════════════════════

ALTER TABLE atendimento.patients
  ADD COLUMN IF NOT EXISTS family_members JSONB DEFAULT '[]'::jsonb;

-- Migrar dados legados para family_members
UPDATE atendimento.patients
SET family_members = (
  SELECT jsonb_agg(member)
  FROM (
    SELECT jsonb_build_object(
      'name', mother_name,
      'relationship', 'Mãe'
    ) AS member
    WHERE mother_name IS NOT NULL AND mother_name != ''
    UNION ALL
    SELECT jsonb_build_object(
      'name', father_name,
      'relationship', 'Pai'
    ) AS member
    WHERE father_name IS NOT NULL AND father_name != ''
    UNION ALL
    SELECT jsonb_build_object(
      'name', responsible_name,
      'relationship', 'Responsável Legal',
      'cpf', COALESCE(responsible_cpf, ''),
      'is_legal_guardian', true
    ) AS member
    WHERE responsible_name IS NOT NULL AND responsible_name != ''
      AND responsible_name NOT IN (
        COALESCE(mother_name, ''),
        COALESCE(father_name, '')
      )
  ) sub
)
WHERE (family_members IS NULL OR family_members = '[]'::jsonb)
  AND (
    (mother_name IS NOT NULL AND mother_name != '')
    OR (father_name IS NOT NULL AND father_name != '')
    OR (responsible_name IS NOT NULL AND responsible_name != '')
  );

-- ════════════════════════════════════════════════════════════════
-- 3. appointments — Adicionar coluna guardians se não existe
-- ════════════════════════════════════════════════════════════════

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS guardians JSONB DEFAULT '[]'::jsonb;

-- Migrar mother_name/father_name/parent_name para guardians
UPDATE public.appointments
SET guardians = (
  SELECT jsonb_agg(member)
  FROM (
    SELECT jsonb_build_object(
      'name', mother_name,
      'relationship', 'Mãe'
    ) AS member
    WHERE mother_name IS NOT NULL AND mother_name != ''
    UNION ALL
    SELECT jsonb_build_object(
      'name', father_name,
      'relationship', 'Pai'
    ) AS member
    WHERE father_name IS NOT NULL AND father_name != ''
  ) sub
)
WHERE (guardians IS NULL OR guardians = '[]'::jsonb)
  AND (
    (mother_name IS NOT NULL AND mother_name != '')
    OR (father_name IS NOT NULL AND father_name != '')
  );

-- NOTA: Colunas flat (mother_name, father_name, parent_name, responsible_name)
-- NÃO são removidas — mantidas para backward compat com queries existentes e views da agenda.
