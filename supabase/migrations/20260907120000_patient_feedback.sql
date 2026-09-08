-- Portal-wide patient feedback (floating widget). Inserts go through the
-- service role so guests on auth/onboarding can submit; patients can also
-- insert their own rows. Admins can read everything.

CREATE TABLE IF NOT EXISTS public.patient_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text,
  full_name text,
  category text NOT NULL DEFAULT 'inquiry' CHECK (category IN ('inquiry', 'issue', 'suggestion', 'other')),
  message text NOT NULL,
  page_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS patient_feedback_created_at_idx
  ON public.patient_feedback (created_at DESC);

CREATE INDEX IF NOT EXISTS patient_feedback_user_id_idx
  ON public.patient_feedback (user_id, created_at DESC);

ALTER TABLE public.patient_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patients insert own feedback" ON public.patient_feedback
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "patients read own feedback" ON public.patient_feedback
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "admins read all feedback" ON public.patient_feedback
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

GRANT ALL ON TABLE public.patient_feedback TO anon;
GRANT ALL ON TABLE public.patient_feedback TO authenticated;
GRANT ALL ON TABLE public.patient_feedback TO service_role;
