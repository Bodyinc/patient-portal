-- Delivery / shipping address captured during onboarding intake, and mirrored to the
-- patient profile on claim. state_code (shipping state) already exists on both tables and
-- is reused as the shipping state, so it is not re-added here.

ALTER TABLE public.intake_sessions
  ADD COLUMN IF NOT EXISTS street_address text,
  ADD COLUMN IF NOT EXISTS apartment text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS billing_same_as_shipping boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS billing_street_address text,
  ADD COLUMN IF NOT EXISTS billing_apartment text,
  ADD COLUMN IF NOT EXISTS billing_city text,
  ADD COLUMN IF NOT EXISTS billing_state_code text,
  ADD COLUMN IF NOT EXISTS billing_postal_code text,
  ADD COLUMN IF NOT EXISTS sms_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_consent boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS apartment text,
  ADD COLUMN IF NOT EXISTS sms_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_consent boolean NOT NULL DEFAULT false;
