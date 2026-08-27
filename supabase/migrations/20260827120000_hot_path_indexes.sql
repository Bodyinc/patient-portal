-- Shared hot-path indexes for patient, provider, and admin apps on the same database.
-- Additive only: do not drop tables/columns. Admin and provider still use activity logs,
-- providers, refunds, shop checkout, wallet, and related production tables.

CREATE INDEX IF NOT EXISTS idx_payments_user_created
  ON public.payments (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status
  ON public.subscriptions (user_id, status);

CREATE INDEX IF NOT EXISTS idx_medication_requests_user_created
  ON public.medication_requests (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_additional_payments_user_status
  ON public.additional_payments (user_id, status);

CREATE INDEX IF NOT EXISTS idx_intake_sessions_claimed_updated
  ON public.intake_sessions (claimed_by_user_id, updated_at DESC)
  WHERE claimed_by_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_intake_sessions_incomplete_reminders
  ON public.intake_sessions (status, updated_at)
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_refill_window
  ON public.subscriptions (status, current_period_end)
  WHERE cancel_at_period_end = false AND user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_medication_request_events_created
  ON public.medication_request_events (created_at);

CREATE INDEX IF NOT EXISTS idx_medication_request_events_status_created
  ON public.medication_request_events (status, created_at);
