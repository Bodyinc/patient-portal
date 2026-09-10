-- Inquiry workflow: status, timestamps, and a reply thread so admins can
-- send a solution and patients can follow up / track the query.

ALTER TABLE public.patient_feedback
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

ALTER TABLE public.patient_feedback
  DROP CONSTRAINT IF EXISTS patient_feedback_status_check;

ALTER TABLE public.patient_feedback
  ADD CONSTRAINT patient_feedback_status_check
  CHECK (status IN ('open', 'in_progress', 'needs_info', 'resolved', 'closed'));

CREATE INDEX IF NOT EXISTS patient_feedback_status_idx
  ON public.patient_feedback (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.patient_feedback_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL REFERENCES public.patient_feedback(id) ON DELETE CASCADE,
  author_role text NOT NULL CHECK (author_role IN ('admin', 'patient')),
  author_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS patient_feedback_replies_feedback_id_idx
  ON public.patient_feedback_replies (feedback_id, created_at ASC);

ALTER TABLE public.patient_feedback_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins update feedback" ON public.patient_feedback;
CREATE POLICY "admins update feedback" ON public.patient_feedback
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "patients read own replies" ON public.patient_feedback_replies;
CREATE POLICY "patients read own replies" ON public.patient_feedback_replies
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.patient_feedback f
      WHERE f.id = feedback_id AND f.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "patients insert own replies" ON public.patient_feedback_replies;
CREATE POLICY "patients insert own replies" ON public.patient_feedback_replies
  FOR INSERT TO authenticated
  WITH CHECK (
    author_role = 'patient'
    AND author_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.patient_feedback f
      WHERE f.id = feedback_id AND f.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "admins read all replies" ON public.patient_feedback_replies;
CREATE POLICY "admins read all replies" ON public.patient_feedback_replies
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins insert replies" ON public.patient_feedback_replies;
CREATE POLICY "admins insert replies" ON public.patient_feedback_replies
  FOR INSERT TO authenticated
  WITH CHECK (
    author_role = 'admin'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

GRANT ALL ON TABLE public.patient_feedback_replies TO anon;
GRANT ALL ON TABLE public.patient_feedback_replies TO authenticated;
GRANT ALL ON TABLE public.patient_feedback_replies TO service_role;
