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

import { canAccessStep, getEarliestIncompleteStep } from "./onboarding-navigation";

const STORAGE_KEY = "bodyinc-onboarding-state";

import type { PlanMonths } from "./onboarding-config";

export type OnboardingState = {
  goalId: string | null;
  state: string | null;
  sex: string | null;
  dob: string | null;
  heightFeet: number | null;
  heightInches: number | null;
  weightLbs: number | null;
  bmi: number | null;
  medicationId: string | null;
  fullName: string;
  email: string;
  phone: string;
  questionnaireAnswers: Record<string, string[]>;
  planMonths: PlanMonths | null;
};

export const initialOnboardingState: OnboardingState = {
  goalId: null,
  state: null,
  sex: null,
  dob: null,
  heightFeet: null,
  heightInches: null,
  weightLbs: null,
  bmi: null,
  medicationId: null,
  fullName: "",
  email: "",
  phone: "",
  questionnaireAnswers: {},
  planMonths: null,
};

type OnboardingContextValue = {
  state: OnboardingState;
  hydrated: boolean;
  updateState: (patch: Partial<OnboardingState>) => void;
  resetState: () => void;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

function loadState(): OnboardingState {
  if (typeof window === "undefined") return initialOnboardingState;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return initialOnboardingState;
    return { ...initialOnboardingState, ...JSON.parse(raw) };
  } catch {
    return initialOnboardingState;
  }
}

function saveState(state: OnboardingState) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OnboardingState>(initialOnboardingState);
  const [hydrated, setHydrated] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setState(loadState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveState(state);
  }, [state, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (!pathname.startsWith("/onboarding")) return;
    if (pathname.startsWith("/onboarding/order-confirmation")) return;

    if (!canAccessStep(pathname, state)) {
      router.replace(getEarliestIncompleteStep(state));
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
  }, []);

  const value = useMemo(
    () => ({ state, hydrated, updateState, resetState }),
    [state, hydrated, updateState, resetState],
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
