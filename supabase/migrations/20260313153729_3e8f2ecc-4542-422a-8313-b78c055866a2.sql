-- Add description column to focus_periods
ALTER TABLE public.focus_periods ADD COLUMN description text;

-- Add description column to key_results
ALTER TABLE public.key_results ADD COLUMN description text;