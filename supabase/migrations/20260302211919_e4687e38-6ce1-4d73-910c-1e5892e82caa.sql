
CREATE OR REPLACE FUNCTION public.log_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _entity_name text;
  _user_id uuid;
  _action text;
  _metadata jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _action := 'created';
    _user_id := NEW.user_id;
    _metadata := jsonb_build_object('enterprise_id', COALESCE(NEW.enterprise_id, CASE WHEN TG_TABLE_NAME = 'enterprises' THEN NEW.id ELSE NULL END));
    
    -- Get entity name safely using to_jsonb
    _entity_name := COALESCE(
      (to_jsonb(NEW) ->> 'name'),
      (to_jsonb(NEW) ->> 'title'),
      ''
    );
    
    INSERT INTO public.activity_logs (user_id, entity_type, entity_id, action, entity_name, metadata)
    VALUES (_user_id, TG_TABLE_NAME, NEW.id, _action, _entity_name, _metadata);
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    _action := 'updated';
    _user_id := NEW.user_id;
    _metadata := jsonb_build_object('enterprise_id', COALESCE(NEW.enterprise_id, CASE WHEN TG_TABLE_NAME = 'enterprises' THEN NEW.id ELSE NULL END));
    
    _entity_name := COALESCE(
      (to_jsonb(NEW) ->> 'name'),
      (to_jsonb(NEW) ->> 'title'),
      ''
    );
    
    -- Track status changes specially
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
    VALUES (_user_id, TG_TABLE_NAME, NEW.id, _action, _entity_name, _metadata);
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    _action := 'deleted';
    _user_id := OLD.user_id;
    _metadata := jsonb_build_object('enterprise_id', COALESCE(OLD.enterprise_id, CASE WHEN TG_TABLE_NAME = 'enterprises' THEN OLD.id ELSE NULL END));
    
    _entity_name := COALESCE(
      (to_jsonb(OLD) ->> 'name'),
      (to_jsonb(OLD) ->> 'title'),
      ''
    );
    
    INSERT INTO public.activity_logs (user_id, entity_type, entity_id, action, entity_name, metadata)
    VALUES (_user_id, TG_TABLE_NAME, OLD.id, _action, _entity_name, _metadata);
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$function$;

-- Now create the triggers that were missing
CREATE TRIGGER trg_log_enterprises AFTER INSERT OR UPDATE OR DELETE ON public.enterprises FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER trg_log_projects AFTER INSERT OR UPDATE OR DELETE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER trg_log_tasks AFTER INSERT OR UPDATE OR DELETE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER trg_log_focus_periods AFTER INSERT OR UPDATE OR DELETE ON public.focus_periods FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER trg_log_objectives AFTER INSERT OR UPDATE OR DELETE ON public.objectives FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER trg_log_key_results AFTER INSERT OR UPDATE OR DELETE ON public.key_results FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER trg_log_appointments AFTER INSERT OR UPDATE OR DELETE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.log_activity();
