ALTER TABLE public.ai_voice_settings
  ADD COLUMN IF NOT EXISTS vapi_assistant_id text,
  ADD COLUMN IF NOT EXISTS vapi_phone_number_id text;