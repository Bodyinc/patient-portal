import type { OnboardingState } from "./onboarding-store";
import type { QuestionDto } from "@/lib/intake/types";
import { isQuestionAnswered } from "@/lib/intake/questionnaire";

export const ONBOARDING_STEPS = [
  { id: "goal", path: "/onboarding/goal" },
  { id: "demographics", path: "/onboarding/demographics" },
  { id: "bmi", path: "/onboarding/bmi" },
  { id: "questionnaire", path: "/onboarding/questionnaire" },
  { id: "personal-info", path: "/onboarding/personal-info" },
  { id: "delivery-address", path: "/onboarding/delivery-address" },
  { id: "medications", path: "/onboarding/medications" },
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

function isAddressComplete(state: OnboardingState) {
  return Boolean(
    state.streetAddress && state.apartment && state.city && state.postalCode && state.state,
  );
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

function hasQuestionnaireAnswers(state: OnboardingState) {
  return Object.keys(state.questionnaireAnswers).length > 0;
}

export function getNextStepPath(currentPath: string, state: OnboardingState): string | null {
  const current = getStepByPath(currentPath);
  if (!current) return null;

  if (current.id === "bmi") {
    // Category eligibility is checked on the BMI step — do not advance if ineligible.
    if (state.eligibilityResult === "ineligible") return null;
    return includesQuestionnaire(state) ? "/onboarding/questionnaire" : "/onboarding/personal-info";
  }

  if (current.id === "questionnaire") {
    // Ineligible patients stay on questionnaire; eligible/complete continue to personal info.
    if (!isQuestionnaireComplete(state)) return null;
    return "/onboarding/personal-info";
  }

  const index = getStepIndex(currentPath);
  const next = ONBOARDING_STEPS[index + 1];
  return next?.path ?? null;
}

export function getPrevStepPath(currentPath: string, state: OnboardingState): string | null {
  const current = getStepByPath(currentPath);
  if (!current) return null;

  if (current.id === "personal-info") {
    return includesQuestionnaire(state) ? "/onboarding/questionnaire" : "/onboarding/bmi";
  }

  if (current.id === "questionnaire") {
    return "/onboarding/bmi";
  }

  const index = getStepIndex(currentPath);
  if (index <= 0) return null;
  return ONBOARDING_STEPS[index - 1].path;
}

export function getEarliestIncompleteStep(state: OnboardingState): string {
  if (!state.goalId) return "/onboarding/goal";
  if (!state.state || !state.sex || !state.dob) return "/onboarding/demographics";
  if (!isBmiComplete(state)) return "/onboarding/bmi";

  // Category ineligible before any questionnaire answers — keep them on BMI.
  if (state.eligibilityResult === "ineligible" && !hasQuestionnaireAnswers(state)) {
    return "/onboarding/bmi";
  }

  if (includesQuestionnaire(state) && !isQuestionnaireComplete(state)) {
    return "/onboarding/questionnaire";
  }

  if (!state.fullName || !state.email) return "/onboarding/personal-info";
  if (!isAddressComplete(state)) return "/onboarding/delivery-address";
  if (!state.medicationId) return "/onboarding/medications";
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

type OnboardingRouter = {
  push: (href: string) => unknown;
  replace: (href: string) => unknown;
  prefetch?: (href: string) => unknown;
};

let navigationGraceUntil = 0;

/** Prefetch nearby steps only — prefetching the whole funnel on first paint saturates the network. */
export function prefetchAdjacentOnboardingSteps(
  router: Pick<OnboardingRouter, "prefetch">,
  pathname: string,
) {
  if (!router.prefetch) return;
  const index = getStepIndex(pathname);
  if (index < 0) {
    void router.prefetch(ONBOARDING_STEPS[0].path);
    void router.prefetch(ONBOARDING_STEPS[1].path);
    return;
  }
  const targets = [
    ONBOARDING_STEPS[index - 1]?.path,
    ONBOARDING_STEPS[index + 1]?.path,
    ONBOARDING_STEPS[index + 2]?.path,
    ONBOARDING_STEPS[index + 3]?.path,
  ];
  for (const path of targets) {
    if (path) void router.prefetch(path);
  }
}

export function markOnboardingNavigation() {
  navigationGraceUntil = Date.now() + 1500;
}

export function isOnboardingNavigationPending() {
  return Date.now() < navigationGraceUntil;
}

async function runNavAction(_method: "push" | "replace", action: () => unknown, _href: string) {
  try {
    const result = action();
    if (result && typeof (result as Promise<unknown>).then === "function") {
      // Swallow router rejections so they don't surface as the Next.js [object Event] overlay.
      await (result as Promise<unknown>).catch(() => {});
    }
  } catch {
    // Ignored for the same reason.
  }
}

/** Start navigation immediately — do not await this from Continue/Previous. */
export function pushOnboardingRoute(router: Pick<OnboardingRouter, "push">, href: string) {
  markOnboardingNavigation();
  void runNavAction("push", () => router.push(href), href);
}

export function replaceOnboardingRoute(router: Pick<OnboardingRouter, "replace">, href: string) {
  markOnboardingNavigation();
  void runNavAction("replace", () => router.replace(href), href);
}
