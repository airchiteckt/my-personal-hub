-- AI usage log table
CREATE TABLE public.ai_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  function_type text NOT NULL,
  tokens_used integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_usage_log_created_at ON public.ai_usage_log(created_at DESC);
CREATE INDEX idx_ai_usage_log_user_id ON public.ai_usage_log(user_id);

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own ai usage" ON public.ai_usage_log
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins read all ai usage" ON public.ai_usage_log
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- AI usage limits configuration (singleton-style)
CREATE TABLE public.ai_usage_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_global_limit integer NOT NULL DEFAULT 1000,
  monthly_global_limit integer NOT NULL DEFAULT 20000,
  is_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_usage_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated reads limits" ON public.ai_usage_limits
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins update limits" ON public.ai_usage_limits
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert limits" ON public.ai_usage_limits
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed singleton row
INSERT INTO public.ai_usage_limits (daily_global_limit, monthly_global_limit, is_enabled)
VALUES (1000, 20000, true);

-- Function to check if AI usage is within limits
CREATE OR REPLACE FUNCTION public.check_ai_usage_limit()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _limits record;
  _daily_count integer;
  _monthly_count integer;
BEGIN
  SELECT * INTO _limits FROM public.ai_usage_limits LIMIT 1;
  
  IF _limits IS NULL OR NOT _limits.is_enabled THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'limits_disabled');
  END IF;

  SELECT COUNT(*) INTO _daily_count
  FROM public.ai_usage_log
  WHERE created_at >= date_trunc('day', now());

  IF _daily_count >= _limits.daily_global_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'daily_limit_exceeded',
      'used', _daily_count,
      'limit', _limits.daily_global_limit
    );
  END IF;

  SELECT COUNT(*) INTO _monthly_count
  FROM public.ai_usage_log
  WHERE created_at >= date_trunc('month', now());

  IF _monthly_count >= _limits.monthly_global_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'monthly_limit_exceeded',
      'used', _monthly_count,
      'limit', _limits.monthly_global_limit
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'daily_used', _daily_count,
    'daily_limit', _limits.daily_global_limit,
    'monthly_used', _monthly_count,
    'monthly_limit', _limits.monthly_global_limit
  );
END;
$$;

-- Trigger updated_at on ai_usage_limits
CREATE TRIGGER update_ai_usage_limits_updated_at
  BEFORE UPDATE ON public.ai_usage_limits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();