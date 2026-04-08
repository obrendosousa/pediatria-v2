-- Fix: schedule_access was removed from the UI but column is NOT NULL
-- Add a default value so inserts don't fail

ALTER TABLE atendimento.professionals
  ALTER COLUMN schedule_access SET DEFAULT 'open_record';

-- Also make it nullable for future flexibility
ALTER TABLE atendimento.professionals
  ALTER COLUMN schedule_access DROP NOT NULL;
