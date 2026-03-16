-- Tabela de Notas Fiscais (NF-e) no schema atendimento
-- Executar no schema atendimento

CREATE TABLE IF NOT EXISTS atendimento.invoices (
  id BIGSERIAL PRIMARY KEY,
  patient_id BIGINT NOT NULL,
  taxpayer_doc TEXT,
  taxpayer_name TEXT,
  taxpayer_email TEXT,
  taxpayer_address JSONB DEFAULT '{}',
  service_description TEXT NOT NULL,
  notes TEXT,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_inss NUMERIC(12,2) DEFAULT 0,
  tax_ir NUMERIC(12,2) DEFAULT 0,
  tax_cofins NUMERIC(12,2) DEFAULT 0,
  tax_pis NUMERIC(12,2) DEFAULT 0,
  tax_csll NUMERIC(12,2) DEFAULT 0,
  service_code TEXT,
  generated_by TEXT,
  iss_retained BOOLEAN DEFAULT FALSE,
  send_by_email BOOLEAN DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'processing',
  nfe_number TEXT,
  issued_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index para busca por status e data
CREATE INDEX IF NOT EXISTS idx_invoices_status ON atendimento.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON atendimento.invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_patient_id ON atendimento.invoices(patient_id);

-- RLS
ALTER TABLE atendimento.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read invoices"
  ON atendimento.invoices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert invoices"
  ON atendimento.invoices FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update invoices"
  ON atendimento.invoices FOR UPDATE
  TO authenticated
  USING (true);
