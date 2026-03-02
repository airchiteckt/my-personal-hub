-- Enable realtime for all tables that have subscriptions in the app
ALTER PUBLICATION supabase_realtime ADD TABLE public.rituals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ritual_completions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.enterprises;
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.time_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.focus_periods;
ALTER PUBLICATION supabase_realtime ADD TABLE public.objectives;
ALTER PUBLICATION supabase_realtime ADD TABLE public.key_results;