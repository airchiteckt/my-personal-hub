ALTER TABLE public.journal_entries 
ADD COLUMN IF NOT EXISTS energy_morning integer,
ADD COLUMN IF NOT EXISTS energy_afternoon integer,
ADD COLUMN IF NOT EXISTS energy_evening integer,
ADD COLUMN IF NOT EXISTS lunar_data jsonb;