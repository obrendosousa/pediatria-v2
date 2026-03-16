-- Migration: Link professionals to doctors
-- Adds professional_id column to doctors table so that
-- professionals with has_schedule=true can be linked to agenda doctors.

-- 1. Add column
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS professional_id uuid NULL;

-- 2. Add FK constraint (cross-schema reference)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_doctors_professional_id'
  ) THEN
    ALTER TABLE public.doctors
      ADD CONSTRAINT fk_doctors_professional_id
      FOREIGN KEY (professional_id)
      REFERENCES atendimento.professionals(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Create index for FK lookups
CREATE INDEX IF NOT EXISTS idx_doctors_professional_id
  ON public.doctors (professional_id);

-- 4. Comment
COMMENT ON COLUMN public.doctors.professional_id IS 'Links to atendimento.professionals for enriched profile data';
