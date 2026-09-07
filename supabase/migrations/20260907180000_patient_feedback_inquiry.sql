-- Allow a single "inquiry" category for the portal feedback widget.
-- Keep older values so any rows already saved still validate.

ALTER TABLE public.patient_feedback
  DROP CONSTRAINT IF EXISTS patient_feedback_category_check;

ALTER TABLE public.patient_feedback
  ALTER COLUMN category SET DEFAULT 'inquiry';

ALTER TABLE public.patient_feedback
  ADD CONSTRAINT patient_feedback_category_check
  CHECK (category IN ('inquiry', 'issue', 'suggestion', 'other'));
