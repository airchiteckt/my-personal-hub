
-- 1. Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Add user_id to all existing tables
ALTER TABLE public.enterprises ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.projects ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.tasks ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.priority_settings ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. Drop old permissive policies
DROP POLICY "Public read enterprises" ON public.enterprises;
DROP POLICY "Public insert enterprises" ON public.enterprises;
DROP POLICY "Public update enterprises" ON public.enterprises;
DROP POLICY "Public delete enterprises" ON public.enterprises;

DROP POLICY "Public read projects" ON public.projects;
DROP POLICY "Public insert projects" ON public.projects;
DROP POLICY "Public update projects" ON public.projects;
DROP POLICY "Public delete projects" ON public.projects;

DROP POLICY "Public read tasks" ON public.tasks;
DROP POLICY "Public insert tasks" ON public.tasks;
DROP POLICY "Public update tasks" ON public.tasks;
DROP POLICY "Public delete tasks" ON public.tasks;

DROP POLICY "Public read settings" ON public.priority_settings;
DROP POLICY "Public insert settings" ON public.priority_settings;
DROP POLICY "Public update settings" ON public.priority_settings;

-- 4. Create secure RLS policies
CREATE POLICY "Users read own enterprises" ON public.enterprises FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own enterprises" ON public.enterprises FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own enterprises" ON public.enterprises FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own enterprises" ON public.enterprises FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users read own projects" ON public.projects FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own projects" ON public.projects FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own projects" ON public.projects FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users read own tasks" ON public.tasks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own tasks" ON public.tasks FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own tasks" ON public.tasks FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users read own settings" ON public.priority_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own settings" ON public.priority_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own settings" ON public.priority_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- 5. Delete the old default settings row (no user_id)
DELETE FROM public.priority_settings WHERE user_id IS NULL;
