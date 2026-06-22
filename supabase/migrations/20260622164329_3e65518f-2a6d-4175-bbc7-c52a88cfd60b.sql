
-- Connections: one per user (one Google account)
CREATE TABLE public.google_calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_email text,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_expires_at timestamptz NOT NULL,
  scope text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz,
  UNIQUE(user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_calendar_connections TO authenticated;
GRANT ALL ON public.google_calendar_connections TO service_role;
ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own connection" ON public.google_calendar_connections
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_gcal_conn_updated BEFORE UPDATE ON public.google_calendar_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Calendars discovered from Google, with selection & color
CREATE TABLE public.google_calendar_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_calendar_id text NOT NULL,
  summary text NOT NULL,
  description text,
  background_color text,
  color text,
  enabled boolean NOT NULL DEFAULT true,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, google_calendar_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_calendar_list TO authenticated;
GRANT ALL ON public.google_calendar_list TO service_role;
ALTER TABLE public.google_calendar_list ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own calendar list" ON public.google_calendar_list
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_gcal_list_updated BEFORE UPDATE ON public.google_calendar_list
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Cached events
CREATE TABLE public.external_calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_calendar_id text NOT NULL,
  google_event_id text NOT NULL,
  title text,
  description text,
  location text,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  all_day boolean NOT NULL DEFAULT false,
  html_link text,
  status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, google_calendar_id, google_event_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_calendar_events TO authenticated;
GRANT ALL ON public.external_calendar_events TO service_role;
ALTER TABLE public.external_calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own external events" ON public.external_calendar_events
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role writes external events" ON public.external_calendar_events
  FOR ALL USING (false) WITH CHECK (false);
CREATE INDEX idx_ext_events_user_range ON public.external_calendar_events(user_id, start_at, end_at);
CREATE TRIGGER trg_ext_events_updated BEFORE UPDATE ON public.external_calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
