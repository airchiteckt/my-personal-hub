
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS google_event_id text,
  ADD COLUMN IF NOT EXISTS google_calendar_id text,
  ADD COLUMN IF NOT EXISTS google_connection_id uuid REFERENCES public.google_calendar_connections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS sync_error text;

ALTER TABLE public.google_calendar_list
  ADD COLUMN IF NOT EXISTS is_default_for_writes boolean NOT NULL DEFAULT false;

-- Solo un calendario di default per impresa
CREATE UNIQUE INDEX IF NOT EXISTS uq_default_write_calendar_per_enterprise
  ON public.google_calendar_list (enterprise_id)
  WHERE is_default_for_writes = true AND enterprise_id IS NOT NULL;
