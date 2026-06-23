ALTER TABLE public.enterprises
  ADD COLUMN IF NOT EXISTS is_personal boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS uq_one_personal_enterprise_per_user
  ON public.enterprises (user_id)
  WHERE is_personal = true;

INSERT INTO public.enterprises (user_id, name, color, is_personal)
SELECT u.id, 'Personale', '220 9% 46%', true
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.enterprises e WHERE e.user_id = u.id AND e.is_personal = true
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));

  INSERT INTO public.enterprises (user_id, name, color, is_personal)
  VALUES (NEW.id, 'Personale', '220 9% 46%', true)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;