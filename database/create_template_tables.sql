-- Migration: Modelos de Prontuário e Documentos
-- Schema: atendimento
-- Ref: PRD_CADASTROS_SUPPORT_CLINIC.md §5, §6

-- ============================================================
-- 1. Anamneses
-- ============================================================
CREATE TABLE atendimento.anamnesis_templates (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title                     text        NOT NULL,
  allow_send_on_scheduling  boolean     DEFAULT false,
  created_by                uuid,
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now()
);

CREATE TABLE atendimento.anamnesis_questions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   uuid        NOT NULL REFERENCES atendimento.anamnesis_templates(id) ON DELETE CASCADE,
  question      text        NOT NULL,
  type          text        NOT NULL CHECK (type IN (
                  'text',
                  'checkbox',
                  'gestational_calculator',
                  'multiple_choice'
                )),
  options       jsonb       DEFAULT '[]'::jsonb,
  sort_order    integer     DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

-- ============================================================
-- 2. Atestados
-- ============================================================
CREATE TABLE atendimento.certificate_templates (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  content     text        NOT NULL,
  created_by  uuid,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ============================================================
-- 3. Dietas
-- ============================================================
CREATE TABLE atendimento.diet_templates (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  content     text        NOT NULL,
  created_by  uuid,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ============================================================
-- 4. Evolução
-- ============================================================
CREATE TABLE atendimento.evolution_templates (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  content     text        NOT NULL,
  created_by  uuid,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ============================================================
-- 5. Exames
-- ============================================================
CREATE TABLE atendimento.exam_templates (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  content     text        NOT NULL,
  created_by  uuid,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ============================================================
-- 6. Categorias de Exames (com seed)
-- ============================================================
CREATE TABLE atendimento.exam_categories (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL UNIQUE,
  sort_order  integer,
  created_at  timestamptz DEFAULT now()
);

INSERT INTO atendimento.exam_categories (name, sort_order) VALUES
  ('Avaliação Cardiológica / Atividade Elétrica', 1),
  ('Bioquímica', 2),
  ('Fezes', 3),
  ('Hematologia', 4),
  ('Hormonologia', 5),
  ('Imunologia', 6),
  ('Marcadores Tumorais', 7),
  ('Microbiologia', 8),
  ('Pesquisa de Trombofilias', 9),
  ('Rotina Básica - Hormonal DBM', 10);

-- ============================================================
-- 7. Laudos
-- ============================================================
CREATE TABLE atendimento.report_templates (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  content     text        NOT NULL,
  created_by  uuid,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ============================================================
-- 8. Receitas
-- ============================================================
CREATE TABLE atendimento.recipe_templates (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  content     text        NOT NULL,
  created_by  uuid,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ============================================================
-- 9. Documentos (Termos)
-- ============================================================
CREATE TABLE atendimento.document_templates (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text        NOT NULL,
  content     text        NOT NULL,
  is_default  boolean     DEFAULT false,
  created_by  uuid,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ============================================================
-- 10. Índices
-- ============================================================
CREATE INDEX idx_anamnesis_q_template   ON atendimento.anamnesis_questions (template_id);
CREATE INDEX idx_exam_cat_sort          ON atendimento.exam_categories (sort_order);

-- ============================================================
-- 11. Triggers updated_at (reutiliza atendimento.set_updated_at)
-- ============================================================
CREATE TRIGGER trg_anamnesis_templates_updated_at
  BEFORE UPDATE ON atendimento.anamnesis_templates
  FOR EACH ROW EXECUTE FUNCTION atendimento.set_updated_at();

CREATE TRIGGER trg_certificate_templates_updated_at
  BEFORE UPDATE ON atendimento.certificate_templates
  FOR EACH ROW EXECUTE FUNCTION atendimento.set_updated_at();

CREATE TRIGGER trg_diet_templates_updated_at
  BEFORE UPDATE ON atendimento.diet_templates
  FOR EACH ROW EXECUTE FUNCTION atendimento.set_updated_at();

CREATE TRIGGER trg_evolution_templates_updated_at
  BEFORE UPDATE ON atendimento.evolution_templates
  FOR EACH ROW EXECUTE FUNCTION atendimento.set_updated_at();

CREATE TRIGGER trg_exam_templates_updated_at
  BEFORE UPDATE ON atendimento.exam_templates
  FOR EACH ROW EXECUTE FUNCTION atendimento.set_updated_at();

CREATE TRIGGER trg_report_templates_updated_at
  BEFORE UPDATE ON atendimento.report_templates
  FOR EACH ROW EXECUTE FUNCTION atendimento.set_updated_at();

CREATE TRIGGER trg_recipe_templates_updated_at
  BEFORE UPDATE ON atendimento.recipe_templates
  FOR EACH ROW EXECUTE FUNCTION atendimento.set_updated_at();

CREATE TRIGGER trg_document_templates_updated_at
  BEFORE UPDATE ON atendimento.document_templates
  FOR EACH ROW EXECUTE FUNCTION atendimento.set_updated_at();

-- ============================================================
-- 12. RLS
-- ============================================================
ALTER TABLE atendimento.anamnesis_templates     ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendimento.anamnesis_questions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendimento.certificate_templates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendimento.diet_templates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendimento.evolution_templates     ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendimento.exam_templates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendimento.exam_categories         ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendimento.report_templates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendimento.recipe_templates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendimento.document_templates      ENABLE ROW LEVEL SECURITY;

-- anamnesis_templates
CREATE POLICY anamnesis_tpl_select ON atendimento.anamnesis_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY anamnesis_tpl_insert ON atendimento.anamnesis_templates
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY anamnesis_tpl_update ON atendimento.anamnesis_templates
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY anamnesis_tpl_delete ON atendimento.anamnesis_templates
  FOR DELETE TO authenticated USING (true);

-- anamnesis_questions
CREATE POLICY anamnesis_q_select ON atendimento.anamnesis_questions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY anamnesis_q_insert ON atendimento.anamnesis_questions
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY anamnesis_q_update ON atendimento.anamnesis_questions
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY anamnesis_q_delete ON atendimento.anamnesis_questions
  FOR DELETE TO authenticated USING (true);

-- certificate_templates
CREATE POLICY certificate_tpl_select ON atendimento.certificate_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY certificate_tpl_insert ON atendimento.certificate_templates
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY certificate_tpl_update ON atendimento.certificate_templates
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY certificate_tpl_delete ON atendimento.certificate_templates
  FOR DELETE TO authenticated USING (true);

-- diet_templates
CREATE POLICY diet_tpl_select ON atendimento.diet_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY diet_tpl_insert ON atendimento.diet_templates
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY diet_tpl_update ON atendimento.diet_templates
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY diet_tpl_delete ON atendimento.diet_templates
  FOR DELETE TO authenticated USING (true);

-- evolution_templates
CREATE POLICY evolution_tpl_select ON atendimento.evolution_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY evolution_tpl_insert ON atendimento.evolution_templates
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY evolution_tpl_update ON atendimento.evolution_templates
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY evolution_tpl_delete ON atendimento.evolution_templates
  FOR DELETE TO authenticated USING (true);

-- exam_templates
CREATE POLICY exam_tpl_select ON atendimento.exam_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY exam_tpl_insert ON atendimento.exam_templates
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY exam_tpl_update ON atendimento.exam_templates
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY exam_tpl_delete ON atendimento.exam_templates
  FOR DELETE TO authenticated USING (true);

-- exam_categories
CREATE POLICY exam_cat_select ON atendimento.exam_categories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY exam_cat_insert ON atendimento.exam_categories
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY exam_cat_update ON atendimento.exam_categories
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY exam_cat_delete ON atendimento.exam_categories
  FOR DELETE TO authenticated USING (true);

-- report_templates
CREATE POLICY report_tpl_select ON atendimento.report_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY report_tpl_insert ON atendimento.report_templates
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY report_tpl_update ON atendimento.report_templates
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY report_tpl_delete ON atendimento.report_templates
  FOR DELETE TO authenticated USING (true);

-- recipe_templates
CREATE POLICY recipe_tpl_select ON atendimento.recipe_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY recipe_tpl_insert ON atendimento.recipe_templates
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY recipe_tpl_update ON atendimento.recipe_templates
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY recipe_tpl_delete ON atendimento.recipe_templates
  FOR DELETE TO authenticated USING (true);

-- document_templates
CREATE POLICY document_tpl_select ON atendimento.document_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY document_tpl_insert ON atendimento.document_templates
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY document_tpl_update ON atendimento.document_templates
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY document_tpl_delete ON atendimento.document_templates
  FOR DELETE TO authenticated USING (true);
