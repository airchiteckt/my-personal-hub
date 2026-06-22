ALTER TABLE public.external_calendar_events
  ADD COLUMN IF NOT EXISTS attendees jsonb,
  ADD COLUMN IF NOT EXISTS organizer jsonb,
  ADD COLUMN IF NOT EXISTS creator jsonb,
  ADD COLUMN IF NOT EXISTS hangout_link text,
  ADD COLUMN IF NOT EXISTS conference_data jsonb;