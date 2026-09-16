-- Store QuickBlox close time so admin, provider, and patient UIs agree
-- when a visit has date_end set in Q-Consultation.

ALTER TABLE public.patient_consultations
  ADD COLUMN IF NOT EXISTS ended_at timestamptz;
