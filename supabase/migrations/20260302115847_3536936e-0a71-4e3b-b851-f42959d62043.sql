
-- Table for storing editable AI system prompts
CREATE TABLE public.ai_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  function_key text NOT NULL, -- e.g. 'reminder', 'task_suggest', 'effort_estimate'
  label text NOT NULL,
  description text,
  system_prompt text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, function_key)
);

ALTER TABLE public.ai_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own prompts" ON public.ai_prompts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own prompts" ON public.ai_prompts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own prompts" ON public.ai_prompts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own prompts" ON public.ai_prompts FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_ai_prompts_updated_at
  BEFORE UPDATE ON public.ai_prompts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
