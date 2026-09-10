-- Solution-sent status: admin cannot close an inquiry as resolved immediately.
-- The patient confirms, or it auto-resolves after 3 days of no reply.

ALTER TABLE public.patient_feedback
  DROP CONSTRAINT IF EXISTS patient_feedback_status_check;

ALTER TABLE public.patient_feedback
  ADD CONSTRAINT patient_feedback_status_check
  CHECK (status IN (
    'open',
    'in_progress',
    'needs_info',
    'awaiting_confirmation',
    'resolved',
    'closed'
  ));
