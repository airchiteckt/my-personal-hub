
CREATE TABLE public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'navigation',
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Everyone can read flags (needed to know what's visible)
CREATE POLICY "Anyone can read feature flags"
ON public.feature_flags FOR SELECT
TO authenticated
USING (true);

-- Only admins can modify flags
CREATE POLICY "Admins can insert feature flags"
ON public.feature_flags FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update feature flags"
ON public.feature_flags FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete feature flags"
ON public.feature_flags FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_feature_flags_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed with default features
INSERT INTO public.feature_flags (key, label, description, category, is_enabled) VALUES
  ('nav_calendar', 'Calendario', 'Sezione Calendario nella navigazione', 'navigation', true),
  ('nav_enterprises', 'Imprese', 'Sezione Imprese nella navigazione', 'navigation', true),
  ('nav_rituals', 'Rituali', 'Sezione Rituali nella navigazione', 'navigation', true),
  ('nav_cockpit', 'Cockpit', 'Sezione Cockpit nella navigazione', 'navigation', true),
  ('nav_requests', 'Richieste', 'Sezione Richieste nella navigazione', 'navigation', true),
  ('feature_ai_assistant', 'AI Assistant', 'Assistente AI flottante', 'feature', true),
  ('feature_journal', 'Diario', 'Funzionalità diario giornaliero', 'feature', true),
  ('feature_okr_wizard', 'OKR Wizard', 'Wizard guidato per OKR', 'feature', true),
  ('feature_smart_backlog', 'Smart Backlog', 'Backlog intelligente con priorità AI', 'feature', true),
  ('feature_public_links', 'Link Pubblici', 'Booking e showcase pubblici', 'feature', true);
