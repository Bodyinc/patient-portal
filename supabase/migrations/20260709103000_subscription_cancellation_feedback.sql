CREATE TABLE IF NOT EXISTS public.subscription_cancellation_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  stripe_subscription_id text NOT NULL,
  reasons text[] NOT NULL,
  other_text text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_cancellation_feedback_user_id
  ON public.subscription_cancellation_feedback(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscription_cancellation_feedback_subscription_id
  ON public.subscription_cancellation_feedback(subscription_id);

ALTER TABLE public.subscription_cancellation_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cancellation feedback"
  ON public.subscription_cancellation_feedback
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cancellation feedback"
  ON public.subscription_cancellation_feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
