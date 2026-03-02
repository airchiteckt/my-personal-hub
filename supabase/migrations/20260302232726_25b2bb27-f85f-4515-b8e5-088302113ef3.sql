ALTER TABLE public.ritual_completions ADD COLUMN status text NOT NULL DEFAULT 'planned';

-- Update existing completions to 'done' since they were previously auto-completed
UPDATE public.ritual_completions SET status = 'done' WHERE status = 'planned';