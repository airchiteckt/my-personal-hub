
ALTER TABLE public.enterprises
ADD COLUMN IF NOT EXISTS public_slug text DEFAULT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS enterprises_public_slug_unique ON public.enterprises (public_slug) WHERE public_slug IS NOT NULL;
