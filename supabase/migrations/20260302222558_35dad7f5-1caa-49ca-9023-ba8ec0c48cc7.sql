
-- Add public_slug to profiles
ALTER TABLE public.profiles ADD COLUMN public_slug text UNIQUE;

-- Create index for fast slug lookups
CREATE UNIQUE INDEX idx_profiles_public_slug ON public.profiles (public_slug) WHERE public_slug IS NOT NULL;

-- Allow public (anon) read on profiles by slug for public pages
CREATE POLICY "Public can read profiles by slug"
ON public.profiles
FOR SELECT
TO anon
USING (public_slug IS NOT NULL);

-- Create a table for public booking requests
CREATE TABLE public.booking_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_user_id uuid NOT NULL,
  guest_name text NOT NULL,
  guest_email text NOT NULL,
  requested_date date NOT NULL,
  requested_start_time text NOT NULL,
  requested_end_time text NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;

-- Host can read/update/delete their booking requests
CREATE POLICY "Host reads own booking requests"
ON public.booking_requests FOR SELECT
TO authenticated
USING (auth.uid() = host_user_id);

CREATE POLICY "Host updates own booking requests"
ON public.booking_requests FOR UPDATE
TO authenticated
USING (auth.uid() = host_user_id);

CREATE POLICY "Host deletes own booking requests"
ON public.booking_requests FOR DELETE
TO authenticated
USING (auth.uid() = host_user_id);

-- Anyone (anon) can insert a booking request
CREATE POLICY "Anyone can create booking requests"
ON public.booking_requests FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Allow anon to read appointments for public calendar (only date/time, no details)
-- We'll use an edge function instead for security
