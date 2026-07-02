import type { OnboardingState } from "./onboarding-store";
import type { QuestionDto } from "@/lib/intake/types";
import { isQuestionAnswered } from "@/lib/intake/questionnaire";

export const ONBOARDING_STEPS = [
  { id: "goal", path: "/onboarding/goal" },
  { id: "demographics", path: "/onboarding/demographics" },
  { id: "bmi", path: "/onboarding/bmi" },
  { id: "medications", path: "/onboarding/medications" },
  { id: "personal-info", path: "/onboarding/personal-info" },
  { id: "questionnaire", path: "/onboarding/questionnaire" },
  { id: "select-plan", path: "/onboarding/select-plan" },
  { id: "billing-checkout", path: "/onboarding/billing-checkout" },
  { id: "order-confirmation", path: "/onboarding/order-confirmation" },
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]["id"];

const REDIRECT_ONLY_PATHS = [
  "/onboarding/quiz",
  "/onboarding/choose-medicine",
  "/onboarding/recommend2",
];

export function isRedirectOnlyPath(pathname: string) {
  return REDIRECT_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function getStepIndex(pathname: string) {
  return ONBOARDING_STEPS.findIndex(
    (s) => pathname === s.path || pathname.startsWith(`${s.path}/`),
  );
}

export function getStepByPath(pathname: string) {
  const index = getStepIndex(pathname);
  return index >= 0 ? ONBOARDING_STEPS[index] : null;
}

function includesQuestionnaire(state: OnboardingState) {
  return state.requiresQuestionnaire;
}

export function areRequiredQuestionsAnswered(
  questions: QuestionDto[],
  answers: OnboardingState["questionnaireAnswers"],
) {
  return questions
    .filter((q) => q.isRequired)
    .every((q) => isQuestionAnswered(q.questionType, answers[q.id]));
}

function isQuestionnaireComplete(state: OnboardingState) {
  if (!state.requiresQuestionnaire) return true;
  if (state.eligibilityResult === "ineligible") return false;
  return state.questionnaireComplete;
}

function isBmiComplete(state: OnboardingState) {
  if (state.bmi !== null) return true;
  return (
    state.heightFeet !== null &&
    state.heightInches !== null &&
    state.weightLbs !== null &&
    state.bmi !== null
  );
}

export function getNextStepPath(currentPath: string, state: OnboardingState): string | null {
  const current = getStepByPath(currentPath);
  if (!current) return null;

  if (current.id === "personal-info") {
    return includesQuestionnaire(state) ? "/onboarding/questionnaire" : "/onboarding/select-plan";
  }

  const index = getStepIndex(currentPath);
  const next = ONBOARDING_STEPS[index + 1];
  return next?.path ?? null;
}

export function getPrevStepPath(currentPath: string, state: OnboardingState): string | null {
  const current = getStepByPath(currentPath);
  if (!current) return null;

  if (current.id === "select-plan") {
    return includesQuestionnaire(state) ? "/onboarding/questionnaire" : "/onboarding/personal-info";
  }

  const index = getStepIndex(currentPath);
  if (index <= 0) return null;
  return ONBOARDING_STEPS[index - 1].path;
}

export function getEarliestIncompleteStep(state: OnboardingState): string {
  if (!state.goalId) return "/onboarding/goal";
  if (!state.state || !state.sex || !state.dob) return "/onboarding/demographics";
  if (!isBmiComplete(state)) return "/onboarding/bmi";
  if (!state.medicationId) return "/onboarding/medications";
  if (!state.fullName || !state.email || !state.phone) return "/onboarding/personal-info";

  if (includesQuestionnaire(state) && !isQuestionnaireComplete(state)) {
    return "/onboarding/questionnaire";
  }

  if (!state.selectedPackageId) return "/onboarding/select-plan";
  if (!state.checkoutConfirmed) return "/onboarding/billing-checkout";
  return "/onboarding/order-confirmation";
}

export function canAccessStep(pathname: string, state: OnboardingState): boolean {
  if (isRedirectOnlyPath(pathname)) return true;

  const earliest = getEarliestIncompleteStep(state);
  const requestedIndex = getStepIndex(pathname);
  const earliestIndex = getStepIndex(earliest);

  if (requestedIndex < 0) return true;
  if (earliestIndex < 0) return true;

  return requestedIndex <= earliestIndex;
}

export function getProgressForPath(pathname: string) {
  const coreSteps = ONBOARDING_STEPS.filter(
    (s) => s.id !== "billing-checkout" && s.id !== "order-confirmation",
  );
  const index = coreSteps.findIndex(
    (s) => pathname === s.path || pathname.startsWith(`${s.path}/`),
  );
  if (index < 0) return { current: 0, total: coreSteps.length, percent: 0 };
  return {
    current: index + 1,
    total: coreSteps.length,
    percent: Math.round(((index + 1) / coreSteps.length) * 100),
  };
}
