-- Activity Logs table (covers Activity Log + Changelog)
CREATE TABLE public.activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  entity_type text NOT NULL, -- 'enterprise', 'project', 'task', 'focus_period', 'objective', 'key_result', 'appointment'
  entity_id uuid NOT NULL,
  action text NOT NULL, -- 'created', 'updated', 'deleted', 'completed', 'scheduled', 'unscheduled', 'archived'
  entity_name text, -- human-readable name of the entity at the time of action
  changes jsonb, -- for changelog: { field: { old: ..., new: ... } }
  metadata jsonb, -- extra context (enterprise_id, project_id, etc.)
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_logs_user ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_entity ON public.activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_created ON public.activity_logs(created_at DESC);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own activity logs"
  ON public.activity_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own activity logs"
  ON public.activity_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own activity logs"
  ON public.activity_logs FOR DELETE
  USING (auth.uid() = user_id);

-- Time Entries table (for Time Tracking)
CREATE TABLE public.time_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  enterprise_id uuid REFERENCES public.enterprises(id) ON DELETE CASCADE NOT NULL,
  description text,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  duration_minutes integer, -- computed or manual
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_time_entries_user ON public.time_entries(user_id);
CREATE INDEX idx_time_entries_task ON public.time_entries(task_id);
CREATE INDEX idx_time_entries_project ON public.time_entries(project_id);
CREATE INDEX idx_time_entries_started ON public.time_entries(started_at DESC);

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own time entries"
  ON public.time_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own time entries"
  ON public.time_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own time entries"
  ON public.time_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own time entries"
  ON public.time_entries FOR DELETE
  USING (auth.uid() = user_id);