
-- Focus Periods table
CREATE TABLE public.focus_periods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  enterprise_id UUID NOT NULL REFERENCES public.enterprises(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'future' CHECK (status IN ('active', 'future', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.focus_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own focus_periods" ON public.focus_periods FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own focus_periods" ON public.focus_periods FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own focus_periods" ON public.focus_periods FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own focus_periods" ON public.focus_periods FOR DELETE USING (auth.uid() = user_id);

-- Objectives table
CREATE TABLE public.objectives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  focus_period_id UUID NOT NULL REFERENCES public.focus_periods(id) ON DELETE CASCADE,
  enterprise_id UUID NOT NULL REFERENCES public.enterprises(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  weight INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.objectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own objectives" ON public.objectives FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own objectives" ON public.objectives FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own objectives" ON public.objectives FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own objectives" ON public.objectives FOR DELETE USING (auth.uid() = user_id);

-- Key Results table
CREATE TABLE public.key_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  objective_id UUID NOT NULL REFERENCES public.objectives(id) ON DELETE CASCADE,
  enterprise_id UUID NOT NULL REFERENCES public.enterprises(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  target_value NUMERIC NOT NULL DEFAULT 100,
  current_value NUMERIC NOT NULL DEFAULT 0,
  metric_type TEXT NOT NULL DEFAULT 'percentage' CHECK (metric_type IN ('number', 'percentage', 'boolean')),
  deadline DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'at_risk', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.key_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own key_results" ON public.key_results FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own key_results" ON public.key_results FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own key_results" ON public.key_results FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own key_results" ON public.key_results FOR DELETE USING (auth.uid() = user_id);

-- Add key_result_id to projects table (optional link)
ALTER TABLE public.projects ADD COLUMN key_result_id UUID REFERENCES public.key_results(id) ON DELETE SET NULL;
ALTER TABLE public.projects ADD COLUMN is_strategic_lever BOOLEAN NOT NULL DEFAULT false;

-- Trigger for key_results updated_at
CREATE TRIGGER update_key_results_updated_at
  BEFORE UPDATE ON public.key_results
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
