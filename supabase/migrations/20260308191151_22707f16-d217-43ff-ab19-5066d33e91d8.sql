
-- Add showcase settings to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS showcase_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS showcase_password text DEFAULT NULL;

-- Add public visibility to enterprises
ALTER TABLE public.enterprises
ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;
