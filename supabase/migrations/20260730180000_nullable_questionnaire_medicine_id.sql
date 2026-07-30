-- Allow questionnaire responses and eligibility to be recorded before a medicine is chosen.
-- Goal/category questionnaires run after BMI and before personal info / medicine selection.

alter table public.intake_session_questionnaire_responses
  alter column medicine_id drop not null;

alter table public.intake_session_eligibility_results
  alter column medicine_id drop not null;
