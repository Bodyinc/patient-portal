ALTER TABLE public.medication_categories
  ADD COLUMN IF NOT EXISTS image_url text;
