
-- Table to track appointment email reminders
CREATE TABLE public.appointment_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  reminder_type text NOT NULL, -- '24h', '1h', '15m'
  scheduled_for timestamptz NOT NULL,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(appointment_id, reminder_type)
);

ALTER TABLE public.appointment_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own reminders" ON public.appointment_reminders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own reminders" ON public.appointment_reminders
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Function to auto-create/update reminders when an appointment is created or updated
CREATE OR REPLACE FUNCTION public.manage_appointment_reminders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  appt_timestamp timestamptz;
BEGIN
  -- Build full timestamp from date + start_time
  appt_timestamp := (NEW.date || ' ' || NEW.start_time)::timestamptz;

  -- Delete existing reminders for this appointment (for updates)
  DELETE FROM public.appointment_reminders WHERE appointment_id = NEW.id;

  -- Insert 24h reminder (only if appointment is > 24h from now)
  IF appt_timestamp - INTERVAL '24 hours' > now() THEN
    INSERT INTO public.appointment_reminders (appointment_id, user_id, reminder_type, scheduled_for)
    VALUES (NEW.id, NEW.user_id, '24h', appt_timestamp - INTERVAL '24 hours');
  END IF;

  -- Insert 1h reminder (only if appointment is > 1h from now)
  IF appt_timestamp - INTERVAL '1 hour' > now() THEN
    INSERT INTO public.appointment_reminders (appointment_id, user_id, reminder_type, scheduled_for)
    VALUES (NEW.id, NEW.user_id, '1h', appt_timestamp - INTERVAL '1 hour');
  END IF;

  -- Insert 15m reminder (only if appointment is > 15m from now)
  IF appt_timestamp - INTERVAL '15 minutes' > now() THEN
    INSERT INTO public.appointment_reminders (appointment_id, user_id, reminder_type, scheduled_for)
    VALUES (NEW.id, NEW.user_id, '15m', appt_timestamp - INTERVAL '15 minutes');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_manage_appointment_reminders
  AFTER INSERT OR UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.manage_appointment_reminders();

-- Function to get user email (security definer to access auth.users)
CREATE OR REPLACE FUNCTION public.get_user_email(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT email FROM auth.users WHERE id = _user_id;
$$;
