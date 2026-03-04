-- Create admin role enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS: only admins can read user_roles
CREATE POLICY "Admins can read roles" ON public.user_roles
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Assign admin role to Stanislao Elefante
INSERT INTO public.user_roles (user_id, role)
VALUES ('07aaad49-a37f-4ff8-b3ae-dcb131e94d77', 'admin');

-- Create ai_voice_settings table for TTS/STT/LLM parameterization
CREATE TABLE public.ai_voice_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- TTS settings
  tts_voice_id text NOT NULL DEFAULT 'JBFqnCBsd6RMkjVDRZzb',
  tts_model text NOT NULL DEFAULT 'eleven_turbo_v2_5',
  tts_stability numeric NOT NULL DEFAULT 0.5,
  tts_similarity_boost numeric NOT NULL DEFAULT 0.75,
  tts_style numeric NOT NULL DEFAULT 0.5,
  tts_speed numeric NOT NULL DEFAULT 1.0,
  tts_use_speaker_boost boolean NOT NULL DEFAULT true,
  -- STT settings
  stt_model text NOT NULL DEFAULT 'scribe_v2',
  stt_language_code text NOT NULL DEFAULT 'ita',
  stt_diarize boolean NOT NULL DEFAULT false,
  -- LLM settings
  llm_model text NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  llm_temperature numeric NOT NULL DEFAULT 0.7,
  llm_max_tokens integer NOT NULL DEFAULT 512,
  llm_system_prompt text NOT NULL DEFAULT 'Sei Radar, il Chief Strategy Officer AI di FlyDeck. Rispondi in modo conciso, professionale e diretto in italiano. Massimo 2-3 frasi.'
);

ALTER TABLE public.ai_voice_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage voice settings
CREATE POLICY "Admins can read voice settings" ON public.ai_voice_settings
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert voice settings" ON public.ai_voice_settings
FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update voice settings" ON public.ai_voice_settings
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Anyone authenticated can read (for the edge functions to use)
CREATE POLICY "Authenticated can read voice settings" ON public.ai_voice_settings
FOR SELECT TO authenticated USING (true);

-- Insert default settings row
INSERT INTO public.ai_voice_settings DEFAULT VALUES;

-- Trigger for updated_at
CREATE TRIGGER update_ai_voice_settings_updated_at
  BEFORE UPDATE ON public.ai_voice_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();