CREATE TABLE public.radar_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  scope_type text NOT NULL,
  scope_id uuid NOT NULL,
  label text,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, scope_type, scope_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.radar_threads TO authenticated;
GRANT ALL ON public.radar_threads TO service_role;
ALTER TABLE public.radar_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own radar threads" ON public.radar_threads FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_radar_threads_updated_at BEFORE UPDATE ON public.radar_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();