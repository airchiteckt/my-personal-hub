
-- Add meeting type, duration and location fields to booking_requests
ALTER TABLE public.booking_requests 
  ADD COLUMN meeting_type text NOT NULL DEFAULT 'video_call',
  ADD COLUMN duration_minutes integer NOT NULL DEFAULT 30,
  ADD COLUMN location text;
