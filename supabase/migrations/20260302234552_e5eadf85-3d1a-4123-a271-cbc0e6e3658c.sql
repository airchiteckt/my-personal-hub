CREATE OR REPLACE FUNCTION public.log_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _entity_name text;
  _user_id uuid;
  _action text;
  _metadata jsonb;
  _enterprise_id uuid;
  _row jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _row := to_jsonb(OLD);
  ELSE
    _row := to_jsonb(NEW);
  END IF;

  -- Safely extract enterprise_id using jsonb (avoids "no field" error)
  _enterprise_id := COALESCE(
    (_row ->> 'enterprise_id')::uuid,
    CASE WHEN TG_TABLE_NAME = 'enterprises' THEN (_row ->> 'id')::uuid ELSE NULL END
  );

  _entity_name := COALESCE(
    _row ->> 'name',
    _row ->> 'title',
    ''
  );

  _metadata := jsonb_build_object('enterprise_id', _enterprise_id);

  IF TG_OP = 'INSERT' THEN
    _action := 'created';
    _user_id := (_row ->> 'user_id')::uuid;

    INSERT INTO public.activity_logs (user_id, entity_type, entity_id, action, entity_name, metadata)
    VALUES (_user_id, TG_TABLE_NAME, (NEW.id)::uuid, _action, _entity_name, _metadata);
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    _action := 'updated';
    _user_id := (_row ->> 'user_id')::uuid;

    IF TG_TABLE_NAME = 'tasks' AND OLD.status IS DISTINCT FROM NEW.status THEN
      IF NEW.status = 'done' THEN _action := 'completed';
      ELSIF NEW.status = 'scheduled' THEN _action := 'scheduled';
      ELSIF NEW.status = 'backlog' AND OLD.status = 'scheduled' THEN _action := 'unscheduled';
      END IF;
    END IF;

    IF TG_TABLE_NAME = 'focus_periods' AND OLD.status IS DISTINCT FROM NEW.status THEN
      IF NEW.status = 'archived' THEN _action := 'archived'; END IF;
    END IF;

    INSERT INTO public.activity_logs (user_id, entity_type, entity_id, action, entity_name, metadata)
    VALUES (_user_id, TG_TABLE_NAME, (NEW.id)::uuid, _action, _entity_name, _metadata);
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    _action := 'deleted';
    _user_id := (_row ->> 'user_id')::uuid;

    INSERT INTO public.activity_logs (user_id, entity_type, entity_id, action, entity_name, metadata)
    VALUES (_user_id, TG_TABLE_NAME, (OLD.id)::uuid, _action, _entity_name, _metadata);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;