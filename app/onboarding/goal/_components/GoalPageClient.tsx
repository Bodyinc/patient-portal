"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { saveIntakeCategory } from "@/lib/actions/intake";
import { intakeQueryKeys } from "@/lib/intake/query-keys";
import type { CategoryDto } from "@/lib/intake/types";

import GoalOptionCard from "../../_components/GoalOptionCard";
import OnboardingStepLayout from "../../_components/OnboardingStepLayout";
import { useIntakeCategories } from "../../_hooks/use-intake-catalog";
import {
  prefetchMedicinesForCategory,
  prefetchQuestionnaireForCategory,
} from "../../_lib/intake-query";
import { getNextStepPath, pushOnboardingRoute } from "../../_lib/onboarding-navigation";
import { useOnboarding } from "../../_lib/onboarding-store";

type GoalPageClientProps = {
  initialCategories: CategoryDto[];
  initialError: string | null;
};

function GoalGridSkeleton() {
  return (
    <div className="mx-auto grid w-full grid-cols-2 gap-x-2 gap-y-5 sm:grid-cols-4 sm:gap-x-3 sm:gap-y-6">
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} className="w-full">
          <div className="aspect-[203/231] w-full animate-pulse rounded-[12px] bg-[#E8EEED]" />
          <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-[#E8EEED]" />
          <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-[#E8EEED]" />
        </div>
      ))}
    </div>
  );
}

export default function GoalPageClient({ initialCategories, initialError }: GoalPageClientProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { state, updateState, hydrated } = useOnboarding();
  const [selected, setSelected] = useState(state.goalId ?? "");
  const [saving, setSaving] = useState(false);
  const {
    data: categories = initialCategories,
    isLoading,
    isError,
    error,
    refetch,
  } = useIntakeCategories(initialError ? undefined : initialCategories);

  useEffect(() => {
    if (!hydrated) return;
    if (state.goalId) setSelected(state.goalId);
  }, [hydrated, state.goalId]);

  // Only blur others after a real, known selection — never while empty/stale.
  const hasValidSelection = Boolean(selected) && categories.some((goal) => goal.slug === selected);

  useEffect(() => {
    if (isLoading || !selected) return;
    if (!categories.some((goal) => goal.slug === selected)) {
      setSelected("");
    }
  }, [categories, isLoading, selected]);

  // Prefill the email carried over from a login attempt for a not-yet-registered address
  // (/auth and /otp-login redirect here with ?email=), so the funnel doesn't ask twice.
  useEffect(() => {
    if (!hydrated || state.email) return;
    const emailParam = new URLSearchParams(window.location.search).get("email");
    if (emailParam) updateState({ email: emailParam });
  }, [hydrated, state.email, updateState]);

  async function handleContinue() {
    if (!selected) {
      toast.error("Please select a goal");
      return;
    }

    const category = categories.find((goal) => goal.slug === selected);
    const questionnaireState = queryClient.getQueryState(intakeQueryKeys.questionnaire(selected));
    const requiresQuestionnaire = questionnaireState?.dataUpdatedAt
      ? Boolean(questionnaireState.data)
      : true;

    const patch = {
      goalId: selected,
      goalName: category?.name ?? state.goalName,
      medicationId: null,
      requiresQuestionnaire,
      questionnaireAnswers: {},
      questionnaireComplete: false,
      selectedPackageId: null,
      eligibilityResult: null,
      checkoutConfirmed: false,
    };

    if (state.goalId === selected) {
      const next = getNextStepPath("/onboarding/goal", { ...state, goalId: selected });
      if (next) pushOnboardingRoute(router, next);
      return;
    }

    setSaving(true);
    const savePromise = saveIntakeCategory(selected);
    updateState(patch);
    const next = getNextStepPath("/onboarding/goal", { ...state, ...patch });
    if (next) pushOnboardingRoute(router, next);

    try {
      const result = await savePromise;
      if (!result.ok) {
        toast.error(result.message);
        pushOnboardingRoute(router, "/onboarding/goal");
        return;
      }
      updateState({
        goalName: result.data.goalName,
        requiresQuestionnaire: result.data.requiresQuestionnaire,
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "Unable to save your goal. Please try again.";
      toast.error(message);
      pushOnboardingRoute(router, "/onboarding/goal");
    }
  }

  const showError = isError || Boolean(initialError && categories.length === 0);
  const errorMessage =
    error instanceof Error ? error.message : initialError || "Unable to load goals right now.";

  return (
    <OnboardingStepLayout
      title="Choose your health goal."
      description=""
      onContinue={handleContinue}
      continueDisabled={!selected || saving || isLoading || showError}
      continueLabel="Continue"
      showBack={false}
      variant="bare"
      align="center"
      maxWidth="7xl"
      layout="fill"
    >
      {showError ? (
        <div className="mx-auto max-w-md space-y-4 text-center">
          <p className="text-[14px] text-[#152A51]/80">{errorMessage}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="h-[45px] rounded-[14px] bg-[#E8EEED] px-5 text-[14px] font-medium text-[#152A51]"
          >
            Try again
          </button>
        </div>
      ) : isLoading && categories.length === 0 ? (
        <GoalGridSkeleton />
      ) : (
        <div className="mx-auto grid w-full grid-cols-2 gap-x-2 gap-y-5 sm:grid-cols-4 sm:gap-x-3 sm:gap-y-6">
          {categories.map((goal, index) => (
            <GoalOptionCard
              key={goal.slug}
              goal={goal}
              selected={hasValidSelection && selected === goal.slug}
              dimmed={hasValidSelection && selected !== goal.slug}
              priority={index < 4}
              onClick={() => {
                setSelected(goal.slug);
                const slug = goal.slug;
                requestAnimationFrame(() => {
                  void prefetchMedicinesForCategory(queryClient, slug);
                  void prefetchQuestionnaireForCategory(queryClient, slug);
                });
              }}
            />
          ))}
        </div>
      )}
    </OnboardingStepLayout>
  );
}
