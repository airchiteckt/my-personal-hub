-- Fix appointment reminders timezone handling
-- Times stored in appointments.date/start_time are in user local time (Europe/Rome)
-- but were being cast to timestamptz using DB timezone (UTC), causing
-- reminders to fire 1-2 hours late depending on DST.

CREATE OR REPLACE FUNCTION public.manage_appointment_reminders()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  appt_timestamp timestamptz;
BEGIN
  -- Build full timestamp interpreting date+time as Europe/Rome local time
  -- This correctly handles both CET (UTC+1) and CEST (UTC+2) DST transitions.
  appt_timestamp := ((NEW.date || ' ' || NEW.start_time)::timestamp AT TIME ZONE 'Europe/Rome');

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
$function$;

-- Recompute all pending reminders for future appointments using the corrected logic.
-- This fixes already-scheduled reminders that were created with the buggy UTC interpretation.
DO $$
DECLARE
  appt RECORD;
  appt_ts timestamptz;
BEGIN
  FOR appt IN
    SELECT DISTINCT a.*
    FROM public.appointments a
    JOIN public.appointment_reminders r ON r.appointment_id = a.id
    WHERE r.status = 'pending'
  LOOP
    appt_ts := ((appt.date || ' ' || appt.start_time)::timestamp AT TIME ZONE 'Europe/Rome');

    -- Remove only pending reminders (preserve sent/failed history)
    DELETE FROM public.appointment_reminders
    WHERE appointment_id = appt.id AND status = 'pending';

    IF appt_ts - INTERVAL '24 hours' > now() THEN
      INSERT INTO public.appointment_reminders (appointment_id, user_id, reminder_type, scheduled_for)
      VALUES (appt.id, appt.user_id, '24h', appt_ts - INTERVAL '24 hours');
    END IF;

    IF appt_ts - INTERVAL '1 hour' > now() THEN
      INSERT INTO public.appointment_reminders (appointment_id, user_id, reminder_type, scheduled_for)
      VALUES (appt.id, appt.user_id, '1h', appt_ts - INTERVAL '1 hour');
    END IF;

    IF appt_ts - INTERVAL '15 minutes' > now() THEN
      INSERT INTO public.appointment_reminders (appointment_id, user_id, reminder_type, scheduled_for)
      VALUES (appt.id, appt.user_id, '15m', appt_ts - INTERVAL '15 minutes');
    END IF;
  END LOOP;
END $$;