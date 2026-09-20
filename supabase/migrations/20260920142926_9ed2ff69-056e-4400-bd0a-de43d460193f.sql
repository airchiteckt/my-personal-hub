ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number text;

ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS is_urgent boolean NOT NULL DEFAULT false;
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS call_status text;

CREATE TABLE public.voice_calls (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  direction text NOT NULL,
  phone_number text,
  reminder_id uuid REFERENCES public.reminders(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'started',
  summary text,
  elevenlabs_conversation_id text,
  twilio_call_sid text,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_calls TO authenticated;
GRANT ALL ON public.voice_calls TO service_role;
ALTER TABLE public.voice_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own voice calls" ON public.voice_calls FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Service manages voice calls" ON public.voice_calls FOR ALL TO service_role USING (true) WITH CHECK (true);