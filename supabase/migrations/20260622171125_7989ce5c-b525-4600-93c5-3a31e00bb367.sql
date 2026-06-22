DROP INDEX IF EXISTS public.uq_gcal_list_conn_cal;
CREATE UNIQUE INDEX IF NOT EXISTS uq_gcal_list_conn_cal
  ON public.google_calendar_list(connection_id, google_calendar_id);

DROP INDEX IF EXISTS public.uq_ext_events_conn_cal_evt;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ext_events_conn_cal_evt
  ON public.external_calendar_events(connection_id, google_calendar_id, google_event_id);