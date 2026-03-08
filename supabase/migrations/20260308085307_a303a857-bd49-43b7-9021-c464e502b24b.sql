
CREATE TABLE public.wizard_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  enterprise_id uuid NOT NULL REFERENCES public.enterprises(id) ON DELETE CASCADE,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, enterprise_id)
);

ALTER TABLE public.wizard_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own wizard conversations"
  ON public.wizard_conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own wizard conversations"
  ON public.wizard_conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own wizard conversations"
  ON public.wizard_conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own wizard conversations"
  ON public.wizard_conversations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_wizard_conversations_updated_at
  BEFORE UPDATE ON public.wizard_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
