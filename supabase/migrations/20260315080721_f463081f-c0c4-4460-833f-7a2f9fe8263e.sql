ALTER TABLE public.priority_settings ADD COLUMN work_start_time text NOT NULL DEFAULT '09:00';
ALTER TABLE public.priority_settings ADD COLUMN work_end_time text NOT NULL DEFAULT '19:00';