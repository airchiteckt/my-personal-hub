CREATE TABLE public.task_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  content_type TEXT,
  size_bytes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_attachments TO authenticated;
GRANT ALL ON public.task_attachments TO service_role;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own task attachments" ON public.task_attachments FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read own attachment files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'task-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users upload own attachment files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'task-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own attachment files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'task-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);