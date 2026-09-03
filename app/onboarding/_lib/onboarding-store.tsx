"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";

import { hydrateIntakeState } from "@/lib/actions/intake";
import { fromHeightCm, fromWeightKg } from "@/lib/intake/conversions";
import { intakeQueryKeys } from "@/lib/intake/query-keys";
import type { IntakeSummaryDto, QuestionnaireAnswerValue } from "@/lib/intake/types";
import { legacyAnswersToValues } from "@/lib/intake/questionnaire";
import { DEFAULT_PHONE_COUNTRY_CODE, digitsOnlyZip } from "@/lib/validation";

import {
  canAccessStep,
  getEarliestIncompleteStep,
  isOnboardingNavigationPending,
  prefetchAdjacentOnboardingSteps,
  replaceOnboardingRoute,
} from "./onboarding-navigation";

const STORAGE_KEY = "bodyinc-onboarding-state";

export type OnboardingState = {
  sessionId: string | null;
  goalId: string | null;
  goalName: string | null;
  state: string | null;
  sex: string | null;
  dob: string | null;
  heightFeet: number | null;
  heightInches: number | null;
  weightLbs: number | null;
  bmi: number | null;
  medicationId: string | null;
  variantId: string | null;
  requiresQuestionnaire: boolean;
  fullName: string;
  email: string;
  phone: string;
  phoneCountryCode: string;
  streetAddress: string;
  apartment: string;
  city: string;
  postalCode: string;
  billingSameAsShipping: boolean;
  billingStreetAddress: string;
  billingApartment: string;
  billingCity: string;
  billingStateCode: string;
  billingPostalCode: string;
  smsConsent: boolean;
  marketingConsent: boolean;
  questionnaireAnswers: Record<string, QuestionnaireAnswerValue>;
  questionnaireComplete: boolean;
  selectedPackageId: string | null;
  eligibilityResult: string | null;
  checkoutConfirmed: boolean;
};

export const initialOnboardingState: OnboardingState = {
  sessionId: null,
  goalId: null,
  goalName: null,
  state: null,
  sex: null,
  dob: null,
  heightFeet: null,
  heightInches: null,
  weightLbs: null,
  bmi: null,
  medicationId: null,
  variantId: null,
  requiresQuestionnaire: false,
  fullName: "",
  email: "",
  phone: "",
  phoneCountryCode: DEFAULT_PHONE_COUNTRY_CODE,
  streetAddress: "",
  apartment: "",
  city: "",
  postalCode: "",
  billingSameAsShipping: true,
  billingStreetAddress: "",
  billingApartment: "",
  billingCity: "",
  billingStateCode: "",
  billingPostalCode: "",
  smsConsent: false,
  marketingConsent: false,
  questionnaireAnswers: {},
  questionnaireComplete: false,
  selectedPackageId: null,
  eligibilityResult: null,
  checkoutConfirmed: false,
};

type OnboardingContextValue = {
  state: OnboardingState;
  hydrated: boolean;
  hydrateError: string | null;
  updateState: (patch: Partial<OnboardingState>) => void;
  resetState: () => void;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

function loadState(): OnboardingState {
  if (typeof window === "undefined") return initialOnboardingState;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return initialOnboardingState;
    const parsed = { ...initialOnboardingState, ...JSON.parse(raw) };
    if (parsed.questionnaireAnswers) {
      parsed.questionnaireAnswers = legacyAnswersToValues(parsed.questionnaireAnswers);
    }
    return parsed;
  } catch {
    return initialOnboardingState;
  }
}

function saveState(state: OnboardingState) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function summaryToState(summary: IntakeSummaryDto, prev: OnboardingState): OnboardingState {
  const isNewSession = prev.sessionId !== null && prev.sessionId !== summary.sessionId;
  const base = isNewSession ? { ...initialOnboardingState, sessionId: summary.sessionId } : prev;

  const imperial =
    summary.heightCm !== null && summary.weightKg !== null
      ? {
          heightFeet: fromHeightCm(summary.heightCm).feet,
          heightInches: fromHeightCm(summary.heightCm).inches,
          weightLbs: fromWeightKg(summary.weightKg),
        }
      : {};

  const hasEligibility = Boolean(summary.eligibilityResult);
  const questionnaireComplete =
    !summary.requiresQuestionnaire ||
    (hasEligibility && summary.eligibilityResult !== "ineligible");

  return {
    ...base,
    sessionId: summary.sessionId,
    goalId: summary.goalSlug ?? base.goalId,
    goalName: summary.goalName ?? base.goalName,
    state: summary.stateCode ?? base.state,
    sex: summary.sex ?? base.sex,
    dob: summary.dob ?? base.dob,
    bmi: summary.bmi ?? base.bmi,
    ...imperial,
    medicationId: summary.medicineId ?? base.medicationId,
    requiresQuestionnaire: summary.requiresQuestionnaire,
    fullName: summary.fullName ?? base.fullName,
    email: summary.email ?? base.email,
    phone: summary.phone ?? base.phone,
    phoneCountryCode: summary.phoneCountryCode ?? base.phoneCountryCode,
    streetAddress: summary.streetAddress ?? base.streetAddress,
    apartment: summary.apartment ?? base.apartment,
    city: summary.city ?? base.city,
    postalCode: digitsOnlyZip(summary.postalCode ?? base.postalCode),
    billingSameAsShipping: summary.billingSameAsShipping ?? base.billingSameAsShipping,
    billingStreetAddress: summary.billingStreetAddress ?? base.billingStreetAddress,
    billingApartment: summary.billingApartment ?? base.billingApartment,
    billingCity: summary.billingCity ?? base.billingCity,
    billingStateCode: summary.billingStateCode ?? base.billingStateCode,
    billingPostalCode: digitsOnlyZip(summary.billingPostalCode ?? base.billingPostalCode),
    smsConsent: summary.smsConsent ?? base.smsConsent,
    marketingConsent: summary.marketingConsent ?? base.marketingConsent,
    selectedPackageId: summary.selectedPackageId ?? base.selectedPackageId,
    eligibilityResult: summary.eligibilityResult ?? base.eligibilityResult,
    questionnaireComplete: questionnaireComplete || base.questionnaireComplete,
  };
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OnboardingState>(initialOnboardingState);
  const [hydrated, setHydrated] = useState(false);
  const [hydrateError, setHydrateError] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    prefetchAdjacentOnboardingSteps(router, pathname);
  }, [router, pathname]);

  useEffect(() => {
    setState(loadState());

    void (async () => {
      const result = await hydrateIntakeState();
      if (!result.ok) {
        setHydrateError(result.message);
        setHydrated(true);
        return;
      }

      if (result.data) {
        queryClient.setQueryData(intakeQueryKeys.summary, result.data);
        setState((prev) => summaryToState(result.data!, prev));
      }
      setHydrated(true);
    })();
  }, [queryClient]);

  useEffect(() => {
    if (!hydrated) return;
    saveState(state);
  }, [state, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (!pathname.startsWith("/onboarding")) return;

    const canAccess = canAccessStep(pathname, state);
    const earliest = getEarliestIncompleteStep(state);

    if (!canAccess && !isOnboardingNavigationPending()) {
      replaceOnboardingRoute(router, earliest);
    }
  }, [hydrated, pathname, router, state]);

  const updateState = useCallback((patch: Partial<OnboardingState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetState = useCallback(() => {
    setState(initialOnboardingState);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(STORAGE_KEY);
    }
    void queryClient.invalidateQueries({ queryKey: ["intake"] });
  }, [queryClient]);

  const value = useMemo(
    () => ({ state, hydrated, hydrateError, updateState, resetState }),
    [state, hydrated, hydrateError, updateState, resetState],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used within OnboardingProvider");
  }
  return context;
}
