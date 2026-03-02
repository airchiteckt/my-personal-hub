
-- Task requests from public users
CREATE TABLE public.task_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  host_user_id UUID NOT NULL,
  requester_name TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  suggested_priority TEXT DEFAULT 'medium',
  suggested_deadline DATE,
  enterprise_id UUID REFERENCES public.enterprises(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected, archived
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.task_requests ENABLE ROW LEVEL SECURITY;

-- Host can read/update/delete own requests
CREATE POLICY "Host reads own task requests"
  ON public.task_requests FOR SELECT
  USING (auth.uid() = host_user_id);

CREATE POLICY "Host updates own task requests"
  ON public.task_requests FOR UPDATE
  USING (auth.uid() = host_user_id);

CREATE POLICY "Host deletes own task requests"
  ON public.task_requests FOR DELETE
  USING (auth.uid() = host_user_id);

-- Anyone can create a task request
CREATE POLICY "Anyone can create task requests"
  ON public.task_requests FOR INSERT
  WITH CHECK (true);
