
-- Slot invitations: host proposes specific time slots
CREATE TABLE public.slot_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Proposta orari',
  slug text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  slots jsonb NOT NULL DEFAULT '[]'::jsonb,
  extra_dates jsonb NOT NULL DEFAULT '[]'::jsonb,
  meeting_type text NOT NULL DEFAULT 'video_call',
  duration_minutes integer NOT NULL DEFAULT 30,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

ALTER TABLE public.slot_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own invitations" ON public.slot_invitations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own invitations" ON public.slot_invitations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own invitations" ON public.slot_invitations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own invitations" ON public.slot_invitations FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Public read active invitations" ON public.slot_invitations FOR SELECT USING (status = 'active');

-- Slot responses: invitee picks a slot and optionally indicates extra availability
CREATE TABLE public.slot_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL REFERENCES public.slot_invitations(id) ON DELETE CASCADE,
  respondent_name text NOT NULL,
  respondent_email text NOT NULL,
  selected_slot jsonb,
  extra_availability jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.slot_responses ENABLE ROW LEVEL SECURITY;

-- Anyone can respond (public)
CREATE POLICY "Anyone can insert responses" ON public.slot_responses FOR INSERT WITH CHECK (true);
-- Host can read responses via join
CREATE POLICY "Host reads responses" ON public.slot_responses FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.slot_invitations si WHERE si.id = invitation_id AND si.user_id = auth.uid())
);
CREATE POLICY "Host deletes responses" ON public.slot_responses FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.slot_invitations si WHERE si.id = invitation_id AND si.user_id = auth.uid())
);
