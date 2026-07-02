import "server-only";

import { calculateAgeFromDob, calculateBmiFromMetric } from "@/lib/intake/conversions";
import type { IntakeSessionRow } from "@/lib/intake/session";
import type { EligibilityResultDto } from "@/lib/intake/types";
import type { Json } from "@/lib/supabase/types";

export type CategoryEligibilityRules = {
  min_age?: number;
  max_age?: number;
  min_bmi?: number;
  max_bmi?: number;
  blocked_state_codes?: string[];
  allowed_sex?: string[];
};

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

export type QuestionDisqualifyRules = {
  disqualify_when?: boolean | string | number;
  disqualify_when_true?: boolean;
  disqualify_when_false?: boolean;
};

function parseDisqualifyRules(value: Json): QuestionDisqualifyRules {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as QuestionDisqualifyRules;
}

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

  if (rules.allowed_sex?.length && session.sex) {
    if (!rules.allowed_sex.includes(session.sex)) {
      return {
        result: "ineligible",
        reason: "This treatment is not available for your selected sex.",
      };
    }
  }

  if (session.dob && (rules.min_age !== undefined || rules.max_age !== undefined)) {
    const age = calculateAgeFromDob(session.dob);
    if (age !== null) {
      if (rules.min_age !== undefined && age < rules.min_age) {
        return { result: "ineligible", reason: `Minimum age is ${rules.min_age}.` };
      }
      if (rules.max_age !== undefined && age > rules.max_age) {
        return { result: "ineligible", reason: `Maximum age is ${rules.max_age}.` };
      }
    }
  }

  if (
    session.height_cm !== null &&
    session.weight_kg !== null &&
    (rules.min_bmi !== undefined || rules.max_bmi !== undefined)
  ) {
    const bmi = calculateBmiFromMetric(Number(session.height_cm), Number(session.weight_kg));
    if (bmi !== null) {
      if (rules.min_bmi !== undefined && bmi < rules.min_bmi) {
        return {
          result: "ineligible",
          reason: `Minimum BMI of ${rules.min_bmi} is required.`,
        };
      }
      if (rules.max_bmi !== undefined && bmi > rules.max_bmi) {
        return {
          result: "ineligible",
          reason: `Maximum BMI of ${rules.max_bmi} is required.`,
        };
      }
    }
  }

  return { result: "eligible", reason: null };
}

function isBooleanDisqualifying(
  answer: boolean,
  rules: QuestionDisqualifyRules,
): { disqualified: boolean; reason: string | null } {
  if (rules.disqualify_when_true === true && answer === true) {
    return { disqualified: true, reason: "A disqualifying answer was provided." };
  }
  if (rules.disqualify_when_false === true && answer === false) {
    return { disqualified: true, reason: "A disqualifying answer was provided." };
  }
  if (rules.disqualify_when === true && answer === true) {
    return { disqualified: true, reason: "A disqualifying answer was provided." };
  }
  if (rules.disqualify_when === false && answer === false) {
    return { disqualified: true, reason: "A disqualifying answer was provided." };
  }
  return { disqualified: false, reason: null };
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
      const booleanCheck = isBooleanDisqualifying(response.answer_boolean, rules);
      if (booleanCheck.disqualified) {
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
