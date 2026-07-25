CREATE TABLE public.questionnaire_categories (
  questionnaire_id uuid NOT NULL REFERENCES public.questionnaires(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.medication_categories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (questionnaire_id, category_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.questionnaire_categories TO authenticated;
GRANT SELECT ON public.questionnaire_categories TO anon;
GRANT ALL ON public.questionnaire_categories TO service_role;

ALTER TABLE public.questionnaire_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "questionnaire_categories readable by everyone"
  ON public.questionnaire_categories FOR SELECT
  USING (true);

CREATE POLICY "questionnaire_categories admin write"
  ON public.questionnaire_categories FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TABLE IF EXISTS public.questionnaire_medicines;
;