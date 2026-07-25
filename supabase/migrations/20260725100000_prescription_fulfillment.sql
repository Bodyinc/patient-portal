-- Prescription approval & medication fulfillment.
-- Adds per-medicine approval flags, the approval "request" unit that gates fulfillment,
-- Workflow C additional payments (charged before dispatch when a change costs more), and
-- generated prescriptions visible to patient + provider + admin.
-- Status columns are text + CHECK (matching subscriptions / shop_checkout_orders /
-- refund_requests), not enums, so the state machine can evolve without enum migrations.

-- 1. Per-medicine flags -------------------------------------------------------
-- requires_consultation: purchase must be approved by the assigned provider before fulfillment.
-- requires_followup: re-approval is required on every renewal cycle, not just the first.
ALTER TABLE public.medicines
  ADD COLUMN IF NOT EXISTS requires_consultation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_followup boolean NOT NULL DEFAULT false;

-- 2. Approval request ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.medication_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Nullable: onboarding purchases are guest-first (no account yet at payment); user_id is
  -- backfilled when the patient claims the order. session_id links the pre-claim order.
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  session_id uuid REFERENCES public.intake_sessions(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  -- The paid invoice that created this order; dedup key (invoice.paid + invoice.payment_succeeded
  -- both fire for the same invoice).
  stripe_invoice_id text,
  medicine_id uuid REFERENCES public.medicines(id),
  variant_id uuid REFERENCES public.medicine_variants(id),
  package_id uuid REFERENCES public.packages(id),
  -- provider_id == providers.id == the provider's auth user id (providers.id = auth.uid()).
  provider_id uuid REFERENCES public.providers(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'initial' CHECK (kind IN ('initial', 'followup')),
  -- Full order journey. The patient's tracking timeline is derived from this + requires_consultation
  -- (consultation orders pass through pending_review/approval; others skip straight to approved).
  status text NOT NULL DEFAULT 'payment_completed'
    CHECK (status IN (
      'payment_completed', 'provider_assigned', 'pending_review', 'awaiting_additional_payment',
      'approved', 'prescribed', 'sent_to_pharmacy', 'dispatched', 'delivered', 'rejected', 'cancelled'
    )),
  requires_consultation boolean NOT NULL DEFAULT true,
  tracking_number text,
  -- The billing period this request covers; used to dedup one request per subscription per cycle.
  billing_period_end timestamptz,
  decision_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decision_at timestamptz,
  decision_note text,
  stripe_refund_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS medication_requests_provider_status_idx
  ON public.medication_requests (provider_id, status);
CREATE INDEX IF NOT EXISTS medication_requests_user_idx
  ON public.medication_requests (user_id);
CREATE INDEX IF NOT EXISTS medication_requests_session_idx
  ON public.medication_requests (session_id);
CREATE INDEX IF NOT EXISTS medication_requests_subscription_idx
  ON public.medication_requests (subscription_id);
-- One order per paid invoice: makes webhook order-creation idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS medication_requests_invoice_uidx
  ON public.medication_requests (stripe_invoice_id)
  WHERE stripe_invoice_id IS NOT NULL;

-- 3. Additional (Workflow C) payments ----------------------------------------
CREATE TABLE IF NOT EXISTS public.additional_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.medication_requests(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  reason text,
  from_package_id uuid REFERENCES public.packages(id),
  to_package_id uuid REFERENCES public.packages(id),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'cancelled', 'failed')),
  stripe_payment_intent_id text,
  stripe_invoice_id text,
  stripe_checkout_session_id text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS additional_payments_request_idx
  ON public.additional_payments (request_id);
CREATE INDEX IF NOT EXISTS additional_payments_user_idx
  ON public.additional_payments (user_id);

-- 4. Generated prescriptions --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.medication_requests(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  provider_id uuid REFERENCES public.providers(id) ON DELETE SET NULL,
  medicine_id uuid REFERENCES public.medicines(id),
  variant_id uuid REFERENCES public.medicine_variants(id),
  package_id uuid REFERENCES public.packages(id),
  medicine_name text NOT NULL,
  directions text,
  status text NOT NULL DEFAULT 'generated' CHECK (status IN ('generated', 'voided')),
  document_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prescriptions_request_idx
  ON public.prescriptions (request_id);
CREATE INDEX IF NOT EXISTS prescriptions_user_idx
  ON public.prescriptions (user_id);

-- 5. Status history -----------------------------------------------------------
-- One row per status change: powers the patient tracking timeline (per-stage timestamps)
-- and records which role (admin / provider / system) moved the order.
CREATE TABLE IF NOT EXISTS public.medication_request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.medication_requests(id) ON DELETE CASCADE,
  status text NOT NULL,
  note text,
  actor_role text NOT NULL DEFAULT 'system'
    CHECK (actor_role IN ('system', 'admin', 'provider', 'patient')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS medication_request_events_request_idx
  ON public.medication_request_events (request_id, created_at);

-- 6. RLS ----------------------------------------------------------------------
-- Server functions use the service-role key and bypass RLS; these policies govern
-- direct client reads: patient sees their own rows, provider sees rows assigned to
-- them, admin sees everything.
ALTER TABLE public.medication_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.additional_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_request_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medication_requests admin all" ON public.medication_requests
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "medication_requests patient read own" ON public.medication_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "medication_requests provider read assigned" ON public.medication_requests
  FOR SELECT TO authenticated
  USING (provider_id = auth.uid());
CREATE POLICY "medication_requests provider update assigned" ON public.medication_requests
  FOR UPDATE TO authenticated
  USING (provider_id = auth.uid())
  WITH CHECK (provider_id = auth.uid());

CREATE POLICY "additional_payments admin all" ON public.additional_payments
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "additional_payments patient read own" ON public.additional_payments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "additional_payments provider read assigned" ON public.additional_payments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.medication_requests r
    WHERE r.id = additional_payments.request_id AND r.provider_id = auth.uid()
  ));

CREATE POLICY "prescriptions admin all" ON public.prescriptions
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "prescriptions patient read own" ON public.prescriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "prescriptions provider read assigned" ON public.prescriptions
  FOR SELECT TO authenticated
  USING (provider_id = auth.uid());

CREATE POLICY "medication_request_events admin all" ON public.medication_request_events
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "medication_request_events patient read own" ON public.medication_request_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.medication_requests r
    WHERE r.id = medication_request_events.request_id AND r.user_id = auth.uid()
  ));
CREATE POLICY "medication_request_events provider read assigned" ON public.medication_request_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.medication_requests r
    WHERE r.id = medication_request_events.request_id AND r.provider_id = auth.uid()
  ));
