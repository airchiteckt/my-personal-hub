
ALTER TABLE public.enterprises
  ADD COLUMN business_category text NOT NULL DEFAULT 'scale_opportunity',
  ADD COLUMN time_horizon text NOT NULL DEFAULT '6_18_months';
