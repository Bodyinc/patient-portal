-- Link onboarding inquiries to the intake session so admins can open the
-- right record even before the guest has an account.

ALTER TABLE public.patient_feedback
  ADD COLUMN IF NOT EXISTS intake_session_id uuid REFERENCES public.intake_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS patient_feedback_intake_session_id_idx
  ON public.patient_feedback (intake_session_id)
  WHERE intake_session_id IS NOT NULL;
