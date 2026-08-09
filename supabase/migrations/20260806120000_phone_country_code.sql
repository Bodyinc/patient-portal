-- Store dial / country calling code separately from the national phone number.
ALTER TABLE public.intake_sessions
  ADD COLUMN IF NOT EXISTS phone_country_code text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_country_code text;
