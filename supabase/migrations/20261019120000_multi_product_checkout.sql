-- One checkout can include the primary goal's medicine plus optional products
-- from other categories. Those products share one consultation.

ALTER TABLE public.intake_session_medicines
  ADD COLUMN IF NOT EXISTS package_id uuid REFERENCES public.packages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.medicine_variants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS checkout_group_id uuid,
  ADD COLUMN IF NOT EXISTS is_checkout_primary boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS subscriptions_checkout_group_idx
  ON public.subscriptions (checkout_group_id)
  WHERE checkout_group_id IS NOT NULL;

-- Existing subscriptions are their own checkout (one product, one consultation).
UPDATE public.subscriptions
SET checkout_group_id = id
WHERE checkout_group_id IS NULL;
