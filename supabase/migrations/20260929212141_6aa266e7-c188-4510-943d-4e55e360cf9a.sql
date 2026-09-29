CREATE OR REPLACE FUNCTION public.manage_appointment_reminders()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE appt_timestamp timestamptz;
BEGIN
  appt_timestamp := ((NEW.date || ' ' || NEW.start_time)::timestamp AT TIME ZONE 'Europe/Rome');
  DELETE FROM public.appointment_reminders WHERE appointment_id = NEW.id;
  IF appt_timestamp - INTERVAL '24 hours' > now() THEN
    INSERT INTO public.appointment_reminders (appointment_id, user_id, reminder_type, scheduled_for)
    VALUES (NEW.id, NEW.user_id, '24h', appt_timestamp - INTERVAL '24 hours');
  END IF;
  IF appt_timestamp - INTERVAL '3 hours' > now() THEN
    INSERT INTO public.appointment_reminders (appointment_id, user_id, reminder_type, scheduled_for)
    VALUES (NEW.id, NEW.user_id, '3h', appt_timestamp - INTERVAL '3 hours');
  END IF;
  IF appt_timestamp - INTERVAL '1 hour' > now() THEN
    INSERT INTO public.appointment_reminders (appointment_id, user_id, reminder_type, scheduled_for)
    VALUES (NEW.id, NEW.user_id, '1h', appt_timestamp - INTERVAL '1 hour');
  END IF;
  IF appt_timestamp - INTERVAL '15 minutes' > now() THEN
    INSERT INTO public.appointment_reminders (appointment_id, user_id, reminder_type, scheduled_for)
    VALUES (NEW.id, NEW.user_id, '15m', appt_timestamp - INTERVAL '15 minutes');
  END IF;
  RETURN NEW;
END;
$function$;

INSERT INTO public.appointment_reminders (appointment_id, user_id, reminder_type, scheduled_for)
SELECT a.id, a.user_id, '3h', ((a.date || ' ' || a.start_time)::timestamp AT TIME ZONE 'Europe/Rome') - INTERVAL '3 hours'
FROM public.appointments a
WHERE ((a.date || ' ' || a.start_time)::timestamp AT TIME ZONE 'Europe/Rome') - INTERVAL '3 hours' > now()
  AND NOT EXISTS (SELECT 1 FROM public.appointment_reminders r WHERE r.appointment_id = a.id AND r.reminder_type = '3h');