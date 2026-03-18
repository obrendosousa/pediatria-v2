-- Tabelas de documentos clínicos do prontuário — schema atendimento
-- PRD seções 5.5 a 5.18
-- JÁ APLICADO VIA MCP em 2026-03-12

-- ============================================================
-- 1. clinical_templates — Modelos reutilizáveis
-- ============================================================
CREATE TABLE IF NOT EXISTS atendimento.clinical_templates (
  id BIGSERIAL PRIMARY KEY,
  template_type TEXT NOT NULL CHECK (template_type IN ('anamnese', 'evolucao', 'atestado', 'laudo', 'documento', 'exame', 'receita', 'dieta')),
  title TEXT NOT NULL,
  content TEXT,
  category TEXT,
  is_default BOOLEAN DEFAULT false,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_templates_type ON atendimento.clinical_templates(template_type);

ALTER TABLE atendimento.clinical_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users full access" ON atendimento.clinical_templates
  FOR ALL USING (public.current_user_has_approved_profile())
  WITH CHECK (public.current_user_has_approved_profile());

-- ============================================================
-- 2. anamneses
-- ============================================================
CREATE TABLE IF NOT EXISTS atendimento.anamneses (
  id BIGSERIAL PRIMARY KEY,
  patient_id BIGINT NOT NULL REFERENCES atendimento.patients(id) ON DELETE CASCADE,
  doctor_id INTEGER REFERENCES public.doctors(id),
  appointment_id BIGINT REFERENCES atendimento.appointments(id),
  template_id BIGINT REFERENCES atendimento.clinical_templates(id),
  title TEXT,
  content TEXT,
  signed BOOLEAN DEFAULT false,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anamneses_patient ON atendimento.anamneses(patient_id);
CREATE INDEX IF NOT EXISTS idx_anamneses_appointment ON atendimento.anamneses(appointment_id);

ALTER TABLE atendimento.anamneses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users full access" ON atendimento.anamneses
  FOR ALL USING (public.current_user_has_approved_profile())
  WITH CHECK (public.current_user_has_approved_profile());

-- ============================================================
-- 3. clinical_evolutions
-- ============================================================
CREATE TABLE IF NOT EXISTS atendimento.clinical_evolutions (
  id BIGSERIAL PRIMARY KEY,
  patient_id BIGINT NOT NULL REFERENCES atendimento.patients(id) ON DELETE CASCADE,
  doctor_id INTEGER REFERENCES public.doctors(id),
  appointment_id BIGINT REFERENCES atendimento.appointments(id),
  content TEXT,
  signed BOOLEAN DEFAULT false,
  digital_signature BOOLEAN DEFAULT false,
  show_date BOOLEAN DEFAULT true,
  evolution_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evolutions_patient ON atendimento.clinical_evolutions(patient_id);

ALTER TABLE atendimento.clinical_evolutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users full access" ON atendimento.clinical_evolutions
  FOR ALL USING (public.current_user_has_approved_profile())
  WITH CHECK (public.current_user_has_approved_profile());

-- ============================================================
-- 4. medical_certificates — Atestados
-- ============================================================
CREATE TABLE IF NOT EXISTS atendimento.medical_certificates (
  id BIGSERIAL PRIMARY KEY,
  patient_id BIGINT NOT NULL REFERENCES atendimento.patients(id) ON DELETE CASCADE,
  doctor_id INTEGER REFERENCES public.doctors(id),
  template_id BIGINT REFERENCES atendimento.clinical_templates(id),
  title TEXT,
  content TEXT,
  signed BOOLEAN DEFAULT false,
  digital_signature BOOLEAN DEFAULT false,
  show_date BOOLEAN DEFAULT true,
  certificate_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_certificates_patient ON atendimento.medical_certificates(patient_id);

ALTER TABLE atendimento.medical_certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users full access" ON atendimento.medical_certificates
  FOR ALL USING (public.current_user_has_approved_profile())
  WITH CHECK (public.current_user_has_approved_profile());

-- ============================================================
-- 5. medical_reports — Laudos
-- ============================================================
CREATE TABLE IF NOT EXISTS atendimento.medical_reports (
  id BIGSERIAL PRIMARY KEY,
  patient_id BIGINT NOT NULL REFERENCES atendimento.patients(id) ON DELETE CASCADE,
  doctor_id INTEGER REFERENCES public.doctors(id),
  template_id BIGINT REFERENCES atendimento.clinical_templates(id),
  title TEXT,
  content TEXT,
  signed BOOLEAN DEFAULT false,
  digital_signature BOOLEAN DEFAULT false,
  show_date BOOLEAN DEFAULT true,
  report_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_patient ON atendimento.medical_reports(patient_id);

ALTER TABLE atendimento.medical_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users full access" ON atendimento.medical_reports
  FOR ALL USING (public.current_user_has_approved_profile())
  WITH CHECK (public.current_user_has_approved_profile());

-- ============================================================
-- 6. patient_allergies
-- ============================================================
CREATE TABLE IF NOT EXISTS atendimento.patient_allergies (
  id BIGSERIAL PRIMARY KEY,
  patient_id BIGINT NOT NULL REFERENCES atendimento.patients(id) ON DELETE CASCADE,
  answers BIGINT[] DEFAULT '{}',
  notes JSONB DEFAULT '{}'::jsonb,
  blocked BOOLEAN DEFAULT false,
  allowed_professionals BIGINT[] DEFAULT NULL,
  alert_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT patient_allergies_patient_unique UNIQUE (patient_id)
);

CREATE INDEX IF NOT EXISTS idx_allergies_patient ON atendimento.patient_allergies(patient_id);

ALTER TABLE atendimento.patient_allergies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users full access" ON atendimento.patient_allergies
  FOR ALL USING (public.current_user_has_approved_profile())
  WITH CHECK (public.current_user_has_approved_profile());

-- ============================================================
-- 7. exam_results — Resultados de exames
-- ============================================================
CREATE TABLE IF NOT EXISTS atendimento.exam_results (
  id BIGSERIAL PRIMARY KEY,
  patient_id BIGINT NOT NULL REFERENCES atendimento.patients(id) ON DELETE CASCADE,
  doctor_id INTEGER REFERENCES public.doctors(id),
  exam_name TEXT NOT NULL,
  result_date DATE,
  content TEXT,
  file_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exam_results_patient ON atendimento.exam_results(patient_id);

ALTER TABLE atendimento.exam_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users full access" ON atendimento.exam_results
  FOR ALL USING (public.current_user_has_approved_profile())
  WITH CHECK (public.current_user_has_approved_profile());

-- ============================================================
-- 8. therapeutic_plans — Planos terapêuticos
-- ============================================================
CREATE TABLE IF NOT EXISTS atendimento.therapeutic_plans (
  id BIGSERIAL PRIMARY KEY,
  patient_id BIGINT NOT NULL REFERENCES atendimento.patients(id) ON DELETE CASCADE,
  doctor_id INTEGER REFERENCES public.doctors(id),
  title TEXT,
  description TEXT,
  procedures JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plans_patient ON atendimento.therapeutic_plans(patient_id);
CREATE INDEX IF NOT EXISTS idx_plans_status ON atendimento.therapeutic_plans(status);

ALTER TABLE atendimento.therapeutic_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users full access" ON atendimento.therapeutic_plans
  FOR ALL USING (public.current_user_has_approved_profile())
  WITH CHECK (public.current_user_has_approved_profile());

-- ============================================================
-- 9. patient_attachments — Anexos
-- ============================================================
CREATE TABLE IF NOT EXISTS atendimento.patient_attachments (
  id BIGSERIAL PRIMARY KEY,
  patient_id BIGINT NOT NULL REFERENCES atendimento.patients(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  category TEXT,
  uploaded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attachments_patient ON atendimento.patient_attachments(patient_id);

ALTER TABLE atendimento.patient_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users full access" ON atendimento.patient_attachments
  FOR ALL USING (public.current_user_has_approved_profile())
  WITH CHECK (public.current_user_has_approved_profile());

-- ============================================================
-- 10. patient_images — Galeria de imagens
-- ============================================================
CREATE TABLE IF NOT EXISTS atendimento.patient_images (
  id BIGSERIAL PRIMARY KEY,
  patient_id BIGINT NOT NULL REFERENCES atendimento.patients(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  title TEXT,
  description TEXT,
  category TEXT,
  taken_at DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_images_patient ON atendimento.patient_images(patient_id);

ALTER TABLE atendimento.patient_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users full access" ON atendimento.patient_images
  FOR ALL USING (public.current_user_has_approved_profile())
  WITH CHECK (public.current_user_has_approved_profile());

-- ============================================================
-- 11. clinical_documents — Documentos/Termos
-- ============================================================
CREATE TABLE IF NOT EXISTS atendimento.clinical_documents (
  id BIGSERIAL PRIMARY KEY,
  patient_id BIGINT NOT NULL REFERENCES atendimento.patients(id) ON DELETE CASCADE,
  doctor_id INTEGER REFERENCES public.doctors(id),
  template_id BIGINT REFERENCES atendimento.clinical_templates(id),
  document_type TEXT CHECK (document_type IS NULL OR document_type IN ('termo_consentimento', 'declaracao', 'outro')),
  title TEXT,
  content TEXT,
  signed BOOLEAN DEFAULT false,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_patient ON atendimento.clinical_documents(patient_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON atendimento.clinical_documents(document_type);

ALTER TABLE atendimento.clinical_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users full access" ON atendimento.clinical_documents
  FOR ALL USING (public.current_user_has_approved_profile())
  WITH CHECK (public.current_user_has_approved_profile());
