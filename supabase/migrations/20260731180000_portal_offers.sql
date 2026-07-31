-- Marketing banner offers for the patient portal (e.g. My Meds strip).
-- Coupon text comes from linked promo_codes. Patients never read this via RLS —
-- the portal uses the service role (supabaseAdmin).

CREATE TABLE IF NOT EXISTS public.portal_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id uuid REFERENCES public.promo_codes(id) ON DELETE SET NULL,
  headline text NOT NULL,
  badge_text text,
  cta_label text NOT NULL DEFAULT 'View Treatment Details',
  cta_href text NOT NULL DEFAULT '/shop',
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portal_offers_active_sort_idx
  ON public.portal_offers (is_active, sort_order);

CREATE OR REPLACE TRIGGER trg_portal_offers_updated
  BEFORE UPDATE ON public.portal_offers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.portal_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portal offers admin read" ON public.portal_offers
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "portal offers admin write" ON public.portal_offers
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

GRANT ALL ON TABLE public.portal_offers TO anon;
GRANT ALL ON TABLE public.portal_offers TO authenticated;
GRANT ALL ON TABLE public.portal_offers TO service_role;
