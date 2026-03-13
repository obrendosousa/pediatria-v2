-- Migration: Cadastros Gerais — Colaboradores e Profissionais
-- Schema: atendimento
-- Ref: PRD_CADASTROS_SUPPORT_CLINIC.md §2.1, §2.2

-- Garantir que o schema existe
CREATE SCHEMA IF NOT EXISTS atendimento;

-- ============================================================
-- 1. Colaboradores
-- ============================================================
CREATE TABLE atendimento.collaborators (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL,
  sex             text,
  birth_date      date,
  marital_status  text,
  cpf             text        UNIQUE NOT NULL,
  rg              text,

  -- Endereço
  street          text,
  zip_code        text,
  state           text,
  city            text,
  neighborhood    text,
  number          text,
  complement      text,

  -- Contato
  email           text        NOT NULL,
  phone           text,
  mobile          text,
  whatsapp        text,

  -- Profissional
  role            text        NOT NULL CHECK (role IN (
                    'administrator',
                    'administrative_assistant',
                    'other',
                    'receptionist',
                    'seller'
                  )),
  schedule_access text        NOT NULL CHECK (schedule_access IN (
                    'view_appointment',
                    'open_record'
                  )),
  is_admin        boolean     DEFAULT false,

  -- Complementares
  attachments     jsonb       DEFAULT '[]'::jsonb,
  notes           text,

  status          text        DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by      uuid,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- ============================================================
-- 2. Profissionais
-- ============================================================
CREATE TABLE atendimento.professionals (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text        NOT NULL,
  sex                 text,
  birth_date          date,
  marital_status      text,
  cpf                 text        UNIQUE NOT NULL,
  rg                  text,

  -- Endereço
  street              text,
  zip_code            text,
  state               text,
  city                text,
  neighborhood        text,
  number              text,
  complement          text,

  -- Contato
  email               text        NOT NULL,
  phone               text,
  mobile              text,
  whatsapp            text,

  -- Dados profissionais
  professional_type   text        NOT NULL,
  specialty           text,
  registration_state  text        NOT NULL,
  registration_type   text        NOT NULL,
  registration_number text        NOT NULL,

  schedule_access     text        NOT NULL CHECK (schedule_access IN (
                        'view_appointment',
                        'open_record'
                      )),
  is_admin            boolean     DEFAULT false,
  restrict_prices     boolean     DEFAULT false,
  has_schedule        boolean     DEFAULT false,
  restrict_schedule   boolean     DEFAULT false,

  -- Complementares
  attachments         jsonb       DEFAULT '[]'::jsonb,
  notes               text,

  status              text        DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by          uuid,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- ============================================================
-- 3. Índices
-- ============================================================
CREATE INDEX idx_collaborators_status ON atendimento.collaborators (status);
CREATE INDEX idx_collaborators_cpf    ON atendimento.collaborators (cpf);
CREATE INDEX idx_professionals_status ON atendimento.professionals (status);
CREATE INDEX idx_professionals_cpf    ON atendimento.professionals (cpf);

-- ============================================================
-- 4. Trigger updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION atendimento.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_collaborators_updated_at
  BEFORE UPDATE ON atendimento.collaborators
  FOR EACH ROW EXECUTE FUNCTION atendimento.set_updated_at();

CREATE TRIGGER trg_professionals_updated_at
  BEFORE UPDATE ON atendimento.professionals
  FOR EACH ROW EXECUTE FUNCTION atendimento.set_updated_at();

-- ============================================================
-- 5. RLS
-- ============================================================
ALTER TABLE atendimento.collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendimento.professionals ENABLE ROW LEVEL SECURITY;

-- Collaborators policies
CREATE POLICY collaborators_select ON atendimento.collaborators
  FOR SELECT TO authenticated USING (true);

CREATE POLICY collaborators_insert ON atendimento.collaborators
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY collaborators_update ON atendimento.collaborators
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY collaborators_delete ON atendimento.collaborators
  FOR DELETE TO authenticated USING (true);

-- Professionals policies
CREATE POLICY professionals_select ON atendimento.professionals
  FOR SELECT TO authenticated USING (true);

CREATE POLICY professionals_insert ON atendimento.professionals
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY professionals_update ON atendimento.professionals
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY professionals_delete ON atendimento.professionals
  FOR DELETE TO authenticated USING (true);
