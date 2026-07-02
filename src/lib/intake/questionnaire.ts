import type { QuestionnaireAnswerValue, QuestionType } from "@/lib/intake/types";

export { type QuestionType } from "@/lib/intake/types";

export function normalizeQuestionType(raw: string): QuestionType {
  switch (raw) {
    case "text":
      return "text";
    case "number":
      return "number";
    case "boolean":
    case "yes_no":
      return "boolean";
    case "single_select":
    case "single_choice":
      return "single_select";
    case "multi_select":
    case "multi_choice":
      return "multi_select";
    default:
      if (raw.includes("multi")) return "multi_select";
      if (raw.includes("single")) return "single_select";
      if (raw.includes("yes") || raw.includes("bool")) return "boolean";
      return "text";
  }
}

export function isQuestionAnswered(
  questionType: QuestionType,
  answer: QuestionnaireAnswerValue | undefined,
): boolean {
  if (!answer) return false;

  switch (questionType) {
    case "text":
      return Boolean(answer.text?.trim());
    case "number":
      return answer.number !== null && answer.number !== undefined && !Number.isNaN(answer.number);
    case "boolean":
      return answer.boolean === true || answer.boolean === false;
    case "single_select":
      return (answer.optionIds?.length ?? 0) === 1;
    case "multi_select":
      return (answer.optionIds?.length ?? 0) > 0;
    default:
      return false;
  }
}

export function legacyAnswersToValues(
  legacy: Record<string, QuestionnaireAnswerValue | string[]>,
): Record<string, QuestionnaireAnswerValue> {
  return Object.fromEntries(
    Object.entries(legacy).map(([questionId, value]) => {
      if (Array.isArray(value)) {
        return [questionId, { optionIds: value }];
      }
      return [questionId, value];
    }),
  );
}
