-- lovable-cron-fallback-reviewed: i promemoria devono scattare all'orario esatto (anche chiamata vocale); serve controllo ogni 5 minuti, coerente con i job */5 già attivi (radar-pulse, process-appointment-reminders, google-calendar-sync)
ALTER TABLE public.ai_voice_settings ADD COLUMN IF NOT EXISTS convai_agent_id text;
ALTER TABLE public.ai_voice_settings ADD COLUMN IF NOT EXISTS convai_phone_number_id text;
ALTER TABLE public.ai_voice_settings ADD COLUMN IF NOT EXISTS radar_phone_display text;

create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'process-reminders-every-5-min',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://qjafzzejqksysgakbmhl.supabase.co/functions/v1/process-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqYWZ6emVqcWtzeXNnYWtibWhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NDg3MTcsImV4cCI6MjA4ODAyNDcxN30.nyGMhuaNGriZ_QIY5QzlfMpB2PCiky0VlgZhyH6aZ2U'
    ),
    body := '{}'::jsonb
  );
  $$
);