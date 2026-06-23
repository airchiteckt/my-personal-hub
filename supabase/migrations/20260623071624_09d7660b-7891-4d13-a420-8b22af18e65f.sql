CREATE UNIQUE INDEX IF NOT EXISTS uq_default_write_calendar_personal
  ON public.google_calendar_list (user_id)
  WHERE is_default_for_writes = true AND enterprise_id IS NULL;