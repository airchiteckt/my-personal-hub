
-- Enum types
CREATE TYPE public.enterprise_status AS ENUM ('active', 'development', 'paused');
CREATE TYPE public.project_type AS ENUM ('strategic', 'operational', 'maintenance');
CREATE TYPE public.task_status AS ENUM ('backlog', 'scheduled', 'done');
CREATE TYPE public.task_priority AS ENUM ('high', 'medium', 'low');

-- Enterprises
CREATE TABLE public.enterprises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status enterprise_status NOT NULL DEFAULT 'development',
  color TEXT NOT NULL DEFAULT '220 80% 55%',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.enterprises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read enterprises" ON public.enterprises FOR SELECT USING (true);
CREATE POLICY "Public insert enterprises" ON public.enterprises FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update enterprises" ON public.enterprises FOR UPDATE USING (true);
CREATE POLICY "Public delete enterprises" ON public.enterprises FOR DELETE USING (true);

-- Projects
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES public.enterprises(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type project_type NOT NULL DEFAULT 'operational',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read projects" ON public.projects FOR SELECT USING (true);
CREATE POLICY "Public insert projects" ON public.projects FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update projects" ON public.projects FOR UPDATE USING (true);
CREATE POLICY "Public delete projects" ON public.projects FOR DELETE USING (true);
CREATE INDEX idx_projects_enterprise ON public.projects(enterprise_id);

-- Tasks
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES public.enterprises(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  estimated_minutes INT NOT NULL DEFAULT 30,
  priority task_priority NOT NULL DEFAULT 'medium',
  status task_status NOT NULL DEFAULT 'backlog',
  scheduled_date DATE,
  scheduled_time TEXT,
  deadline TIMESTAMPTZ,
  impact INT CHECK (impact BETWEEN 1 AND 3),
  effort INT CHECK (effort BETWEEN 1 AND 3),
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurring_frequency TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read tasks" ON public.tasks FOR SELECT USING (true);
CREATE POLICY "Public insert tasks" ON public.tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update tasks" ON public.tasks FOR UPDATE USING (true);
CREATE POLICY "Public delete tasks" ON public.tasks FOR DELETE USING (true);
CREATE INDEX idx_tasks_project ON public.tasks(project_id);
CREATE INDEX idx_tasks_enterprise ON public.tasks(enterprise_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_scheduled ON public.tasks(scheduled_date);

-- Priority settings (single-row config table)
CREATE TABLE public.priority_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deadline_boost_enabled BOOLEAN NOT NULL DEFAULT true,
  strategic_weight_enabled BOOLEAN NOT NULL DEFAULT true,
  impact_effort_enabled BOOLEAN NOT NULL DEFAULT true,
  deadline_critical_hours INT NOT NULL DEFAULT 24,
  deadline_high_hours INT NOT NULL DEFAULT 48,
  deadline_attention_hours INT NOT NULL DEFAULT 72,
  deadline_critical_boost INT NOT NULL DEFAULT 3,
  deadline_high_boost INT NOT NULL DEFAULT 2,
  deadline_attention_boost INT NOT NULL DEFAULT 1,
  strategic_weight INT NOT NULL DEFAULT 2,
  operational_weight INT NOT NULL DEFAULT 0,
  maintenance_weight INT NOT NULL DEFAULT -1,
  impact_multiplier INT NOT NULL DEFAULT 2,
  effort_penalty INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.priority_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read settings" ON public.priority_settings FOR SELECT USING (true);
CREATE POLICY "Public insert settings" ON public.priority_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update settings" ON public.priority_settings FOR UPDATE USING (true);

-- Insert default priority settings
INSERT INTO public.priority_settings (id) VALUES (gen_random_uuid());
