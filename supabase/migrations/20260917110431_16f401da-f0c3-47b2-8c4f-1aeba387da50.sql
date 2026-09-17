CREATE TABLE public.radar_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  pre_task boolean NOT NULL DEFAULT true,
  task_checkin boolean NOT NULL DEFAULT true,
  appointment boolean NOT NULL DEFAULT true,
  free_slot boolean NOT NULL DEFAULT true,
  deadline_risk boolean NOT NULL DEFAULT true,
  postponed boolean NOT NULL DEFAULT true,
  day_close boolean NOT NULL DEFAULT true,
  weekly_review boolean NOT NULL DEFAULT true,
  lead_minutes integer NOT NULL DEFAULT 10,
  day_close_time text NOT NULL DEFAULT '18:30',
  max_per_hour integer NOT NULL DEFAULT 4,
  snoozed_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.radar_preferences TO authenticated;
GRANT ALL ON public.radar_preferences TO service_role;
ALTER TABLE public.radar_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own radar preferences" ON public.radar_preferences
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_radar_preferences_updated_at
  BEFORE UPDATE ON public.radar_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.radar_nudges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  entity_table text,
  entity_id uuid,
  dedupe_key text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  telegram_message_id bigint,
  response text,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_radar_nudges_dedupe ON public.radar_nudges (user_id, dedupe_key);
CREATE INDEX idx_radar_nudges_user_sent ON public.radar_nudges (user_id, sent_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.radar_nudges TO authenticated;
GRANT ALL ON public.radar_nudges TO service_role;
ALTER TABLE public.radar_nudges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own radar nudges" ON public.radar_nudges
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS postpone_count integer NOT NULL DEFAULT 0;