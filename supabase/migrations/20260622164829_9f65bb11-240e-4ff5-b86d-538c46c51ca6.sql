
-- 1) Allow multiple connections per user (one per Google account)
ALTER TABLE public.google_calendar_connections DROP CONSTRAINT IF EXISTS google_calendar_connections_user_id_key;
ALTER TABLE public.google_calendar_connections ADD COLUMN IF NOT EXISTS label text;
-- google_email may be null briefly during insert; enforce uniqueness only when present
CREATE UNIQUE INDEX IF NOT EXISTS uq_gcal_conn_user_email
  ON public.google_calendar_connections(user_id, google_email)
  WHERE google_email IS NOT NULL;

-- 2) Link calendars to a specific connection and (optionally) to an enterprise
ALTER TABLE public.google_calendar_list
  ADD COLUMN IF NOT EXISTS connection_id uuid REFERENCES public.google_calendar_connections(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS enterprise_id uuid REFERENCES public.enterprises(id) ON DELETE SET NULL;

-- Backfill connection_id for existing rows (single-connection users)
UPDATE public.google_calendar_list l
SET connection_id = c.id
FROM public.google_calendar_connections c
WHERE l.connection_id IS NULL AND l.user_id = c.user_id;

-- Replace old uniqueness (user, calendar_id) with (connection, calendar_id) so the same
-- google_calendar_id from different accounts doesn't collide.
ALTER TABLE public.google_calendar_list DROP CONSTRAINT IF EXISTS google_calendar_list_user_id_google_calendar_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_gcal_list_conn_cal
  ON public.google_calendar_list(connection_id, google_calendar_id)
  WHERE connection_id IS NOT NULL;

-- 3) Events also tied to a connection (same calendar_id across accounts disambiguated)
ALTER TABLE public.external_calendar_events
  ADD COLUMN IF NOT EXISTS connection_id uuid REFERENCES public.google_calendar_connections(id) ON DELETE CASCADE;

UPDATE public.external_calendar_events e
SET connection_id = c.id
FROM public.google_calendar_connections c
WHERE e.connection_id IS NULL AND e.user_id = c.user_id;

ALTER TABLE public.external_calendar_events DROP CONSTRAINT IF EXISTS external_calendar_events_user_id_google_calendar_id_google_eve_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ext_events_conn_cal_evt
  ON public.external_calendar_events(connection_id, google_calendar_id, google_event_id)
  WHERE connection_id IS NOT NULL;
