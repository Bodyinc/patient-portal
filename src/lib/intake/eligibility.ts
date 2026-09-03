import "server-only";

import { calculateAgeFromDob, calculateBmiFromMetric } from "@/lib/intake/conversions";
import {
  booleanAnswerIsDisqualifying,
  parseDisqualifyRules,
  type QuestionDisqualifyRules,
} from "@/lib/intake/questionnaire";
import type { IntakeSessionRow } from "@/lib/intake/session";
import type { EligibilityResultDto } from "@/lib/intake/types";
import type { Json } from "@/lib/supabase/types";

export type { QuestionDisqualifyRules };

// `sex` and `bmi_bands` are the keys the admin category form writes; `allowed_sex`, `min_bmi` and
// `max_bmi` are the portal's older names, kept as a fallback for rules set outside that form.
// An empty array means "skip this check", matching the admin UI's stated contract.
export type CategoryEligibilityRules = {
  min_age?: number | null;
  max_age?: number | null;
  min_bmi?: number | null;
  max_bmi?: number | null;
  bmi_bands?: string[] | null;
  sex?: string[] | null;
  blocked_state_codes?: string[] | null;
  allowed_sex?: string[] | null;
};

export const BMI_BANDS = ["underweight", "normal", "overweight", "obese"] as const;
export type BmiBand = (typeof BMI_BANDS)[number];

// Thresholds mirror the admin form's band labels (<18.5 / 18.5–24.9 / 25–29.9 / 30+).
function bmiBand(bmi: number): BmiBand {
  if (bmi < 18.5) return "underweight";
  if (bmi < 25) return "normal";
  if (bmi < 30) return "overweight";
  return "obese";
}

// eligibility_rules is a free-form jsonb column and the admin category form persists explicit
// nulls for bounds the operator left blank. A null slips past a `!== undefined` guard and then
// coerces to 0 inside the comparison (`age > null` is `age > 0`), which disqualified every
// patient. Collapse anything that isn't a real number to null so the guards below mean
// "no bound configured".
function bound(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

type QuestionOptionRow = {
  id: string;
  label: string;
  is_disqualifying: boolean;
};

type QuestionnaireResponseRow = {
  question_id: string;
  answer_option_ids: string[];
  answer_boolean?: boolean | null;
  answer_text?: string | null;
  answer_number?: number | null;
};

type QuestionRow = {
  id: string;
  prompt: string;
  question_type: string;
  disqualify_rules: Json;
};

export function evaluateCategoryRules(
  session: Pick<IntakeSessionRow, "state_code" | "sex" | "dob" | "height_cm" | "weight_kg">,
  rules: CategoryEligibilityRules,
): EligibilityResultDto {
  if (rules.blocked_state_codes?.length && session.state_code) {
    if (rules.blocked_state_codes.includes(session.state_code)) {
      return {
        result: "ineligible",
        reason: "Treatment is not available in your state.",
      };
    }
  }

  const allowedSex = rules.sex?.length ? rules.sex : rules.allowed_sex;
  if (allowedSex?.length && session.sex) {
    if (!allowedSex.includes(session.sex)) {
      return {
        result: "ineligible",
        reason: "This treatment is not available for your selected sex.",
      };
    }
  }

  const minAge = bound(rules.min_age);
  const maxAge = bound(rules.max_age);

  if (session.dob && (minAge !== null || maxAge !== null)) {
    const age = calculateAgeFromDob(session.dob);
    if (age !== null) {
      if (minAge !== null && age < minAge) {
        return { result: "ineligible", reason: `Minimum age is ${minAge}.` };
      }
      if (maxAge !== null && age > maxAge) {
        return { result: "ineligible", reason: `Maximum age is ${maxAge}.` };
      }
    }
  }

  const minBmi = bound(rules.min_bmi);
  const maxBmi = bound(rules.max_bmi);
  const allowedBands = rules.bmi_bands?.length ? rules.bmi_bands : null;

  if (
    session.height_cm !== null &&
    session.weight_kg !== null &&
    (minBmi !== null || maxBmi !== null || allowedBands !== null)
  ) {
    const bmi = calculateBmiFromMetric(Number(session.height_cm), Number(session.weight_kg));
    if (bmi !== null) {
      if (minBmi !== null && bmi < minBmi) {
        return {
          result: "ineligible",
          reason: `Minimum BMI of ${minBmi} is required.`,
        };
      }
      if (maxBmi !== null && bmi > maxBmi) {
        return {
          result: "ineligible",
          reason: `Maximum BMI of ${maxBmi} is required.`,
        };
      }
      if (allowedBands && !allowedBands.includes(bmiBand(bmi))) {
        return {
          result: "ineligible",
          reason: `This treatment requires a BMI in the ${allowedBands.join(" or ")} range.`,
        };
      }
    }
  }

  return { result: "eligible", reason: null };
}

export function evaluateQuestionnaireResponses(
  responses: QuestionnaireResponseRow[],
  options: QuestionOptionRow[],
  questions: QuestionRow[] = [],
): EligibilityResultDto {
  const optionMap = new Map(options.map((o) => [o.id, o]));
  const questionMap = new Map(questions.map((q) => [q.id, q]));

  for (const response of responses) {
    for (const optionId of response.answer_option_ids) {
      const option = optionMap.get(optionId);
      if (option?.is_disqualifying) {
        return {
          result: "ineligible",
          reason: `Disqualifying answer selected: ${option.label}`,
        };
      }
    }

    if (response.answer_boolean !== null && response.answer_boolean !== undefined) {
      const question = questionMap.get(response.question_id);
      const rules = parseDisqualifyRules(question?.disqualify_rules ?? {});
      if (booleanAnswerIsDisqualifying(response.answer_boolean, rules)) {
        const prompt = question?.prompt ?? "Question";
        return {
          result: "ineligible",
          reason: `Disqualifying answer: ${prompt}`,
        };
      }
    }
  }

  return { result: "eligible", reason: null };
}

export function combineEligibilityResults(results: EligibilityResultDto[]): EligibilityResultDto {
  const ineligible = results.find((r) => r.result === "ineligible");
  if (ineligible) return ineligible;

  const needsReview = results.find((r) => r.result === "needs_review");
  if (needsReview) return needsReview;

  return { result: "eligible", reason: null };
}

export function hasQuestionnaireResponses(responses: QuestionnaireResponseRow[]): boolean {
  return responses.some(
    (r) =>
      r.answer_option_ids.length > 0 ||
      r.answer_boolean !== null ||
      (r.answer_text !== null && r.answer_text !== "") ||
      r.answer_number !== null,
  );
}
