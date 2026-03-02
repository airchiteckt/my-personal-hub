-- Add planning_mode to rituals: 'fixed' (anchored slot) or 'flexible' (cadence-based)
ALTER TABLE public.rituals
ADD COLUMN planning_mode text NOT NULL DEFAULT 'fixed'
CHECK (planning_mode IN ('fixed', 'flexible'));