-- One QuickBlox consultation per paid subscription.
-- Patients never insert these rows themselves; the portal server writes them after
-- intake is complete and an eligible subscription is confirmed.

CREATE TABLE IF NOT EXISTS public.patient_consultations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  qb_user_id integer NOT NULL,
  qb_appointment_id text NOT NULL,
  qb_dialog_id text,
  started_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT patient_consultations_one_per_subscription UNIQUE (subscription_id)
);

CREATE INDEX IF NOT EXISTS patient_consultations_user_id_idx
  ON public.patient_consultations (user_id, started_at DESC);

ALTER TABLE public.patient_consultations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "patients read own consultations" ON public.patient_consultations;
CREATE POLICY "patients read own consultations" ON public.patient_consultations
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins read all consultations" ON public.patient_consultations;
CREATE POLICY "admins read all consultations" ON public.patient_consultations
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

GRANT SELECT ON TABLE public.patient_consultations TO authenticated;
GRANT ALL ON TABLE public.patient_consultations TO service_role;
