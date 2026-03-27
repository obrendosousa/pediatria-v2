-- Desconto em agendamentos (espelho do padrão de atendimento.budgets)
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS discount_type text DEFAULT '%',
  ADD COLUMN IF NOT EXISTS discount_value numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) DEFAULT 0;

-- Constraint: discount_type deve ser '%' ou 'R$'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'appointments_discount_type_check'
  ) THEN
    ALTER TABLE appointments
      ADD CONSTRAINT appointments_discount_type_check
      CHECK (discount_type IN ('%', 'R$'));
  END IF;
END $$;

-- Constraint: discount_amount não pode exceder total_amount
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'appointments_discount_amount_check'
  ) THEN
    ALTER TABLE appointments
      ADD CONSTRAINT appointments_discount_amount_check
      CHECK (discount_amount >= 0 AND (total_amount IS NULL OR discount_amount <= total_amount));
  END IF;
END $$;

COMMENT ON COLUMN appointments.discount_type IS 'Tipo do desconto: % (percentual) ou R$ (valor fixo)';
COMMENT ON COLUMN appointments.discount_value IS 'Valor bruto do desconto (ex: 10 para 10% ou 50 para R$50)';
COMMENT ON COLUMN appointments.discount_amount IS 'Valor computado do desconto em reais';
