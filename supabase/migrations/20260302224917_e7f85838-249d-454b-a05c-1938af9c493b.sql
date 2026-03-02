
-- Ritual categories enum-like via text constraint
-- Categories: performance, governance, operational
-- Frequencies: daily, weekly, monthly, custom

CREATE TABLE public.rituals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'performance', -- performance | governance | operational
  frequency TEXT NOT NULL DEFAULT 'weekly', -- daily | weekly | monthly | custom
  custom_frequency_days INTEGER[], -- for custom: e.g. [1,3,5] = Mon,Wed,Fri
  estimated_minutes INTEGER NOT NULL DEFAULT 30,
  enterprise_id UUID REFERENCES public.enterprises(id) ON DELETE SET NULL,
  suggested_day INTEGER, -- 0=Sun..6=Sat (for weekly)
  suggested_time TEXT, -- e.g. '09:00'
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.rituals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own rituals" ON public.rituals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own rituals" ON public.rituals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own rituals" ON public.rituals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own rituals" ON public.rituals FOR DELETE USING (auth.uid() = user_id);

-- Completion tracking
CREATE TABLE public.ritual_completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ritual_id UUID NOT NULL REFERENCES public.rituals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  completed_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(ritual_id, completed_date)
);

ALTER TABLE public.ritual_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own completions" ON public.ritual_completions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own completions" ON public.ritual_completions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own completions" ON public.ritual_completions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own completions" ON public.ritual_completions FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at on rituals
CREATE TRIGGER update_rituals_updated_at
  BEFORE UPDATE ON public.rituals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
