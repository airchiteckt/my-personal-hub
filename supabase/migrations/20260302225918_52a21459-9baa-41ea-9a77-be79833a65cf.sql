
-- Add weekly_times_per_week for "N times per week without specific days"
-- Add weekly_specific_days for "weekly on specific days (e.g. Mon+Sat)"
ALTER TABLE public.rituals ADD COLUMN weekly_times_per_week INTEGER;
ALTER TABLE public.rituals ADD COLUMN weekly_specific_days INTEGER[];
