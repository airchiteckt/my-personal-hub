
CREATE TABLE public.journal_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  entry_date date NOT NULL,
  content text NOT NULL DEFAULT '',
  mood text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, entry_date)
);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own journal" ON public.journal_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own journal" ON public.journal_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own journal" ON public.journal_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own journal" ON public.journal_entries FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_journal_updated_at BEFORE UPDATE ON public.journal_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
