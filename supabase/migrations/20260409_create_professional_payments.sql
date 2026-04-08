-- Professional payments ledger for doctor commission tracking
CREATE TABLE public.professional_payments (
  id                        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  financial_transaction_id  BIGINT NOT NULL REFERENCES public.financial_transactions(id) ON DELETE CASCADE,
  appointment_id            BIGINT,
  professional_id           UUID NOT NULL,
  doctor_id                 BIGINT,
  total_commission          NUMERIC(12,2) NOT NULL CHECK (total_commission >= 0),
  status                    TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  paid_at                   TIMESTAMPTZ,
  paid_by                   UUID,
  commission_details        JSONB,
  notes                     TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prof_payments_professional ON public.professional_payments(professional_id);
CREATE INDEX idx_prof_payments_appointment ON public.professional_payments(appointment_id);
CREATE INDEX idx_prof_payments_status ON public.professional_payments(status);
ALTER TABLE public.professional_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY prof_payments_all ON public.professional_payments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
