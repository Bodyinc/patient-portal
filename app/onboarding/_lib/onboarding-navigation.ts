import {
  getQuestionnaireForMedication,
  medicationRequiresQuestionnaire,
} from "./onboarding-config";
import type { OnboardingState } from "./onboarding-store";

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
  return medicationRequiresQuestionnaire(state.medicationId);
}

function isQuestionnaireComplete(state: OnboardingState) {
  const questionnaire = getQuestionnaireForMedication(state.medicationId);
  if (!questionnaire) return true;
  return questionnaire.questions.every((q) => {
    const answers = state.questionnaireAnswers[q.id];
    return Boolean(answers?.length);
  });
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
  if (state.bmi === null || state.heightFeet === null || state.weightLbs === null) {
    return "/onboarding/bmi";
  }
  if (!state.medicationId) return "/onboarding/medications";
  if (!state.fullName || !state.email || !state.phone) return "/onboarding/personal-info";

  if (includesQuestionnaire(state) && !isQuestionnaireComplete(state)) {
    return "/onboarding/questionnaire";
  }

  if (!state.planMonths) return "/onboarding/select-plan";
  return "/onboarding/billing-checkout";
}

export function canAccessStep(pathname: string, state: OnboardingState): boolean {
  if (isRedirectOnlyPath(pathname)) return true;
  if (pathname.startsWith("/onboarding/order-confirmation")) return true;

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
