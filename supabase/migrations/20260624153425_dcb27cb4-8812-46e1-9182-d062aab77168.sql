SELECT cron.schedule(
  'google-calendar-sync-every-5-min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://qjafzzejqksysgakbmhl.supabase.co/functions/v1/google-calendar-sync-cron',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqYWZ6emVqcWtzeXNnYWtibWhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NDg3MTcsImV4cCI6MjA4ODAyNDcxN30.nyGMhuaNGriZ_QIY5QzlfMpB2PCiky0VlgZhyH6aZ2U"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);