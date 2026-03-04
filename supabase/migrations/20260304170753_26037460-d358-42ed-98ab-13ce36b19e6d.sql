ALTER TABLE public.journal_entries REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.journal_entries;