"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { saveIntakeCategory } from "@/lib/actions/intake";

import GoalOptionCard from "../_components/GoalOptionCard";
import OnboardingShell from "../_components/OnboardingShell";
import OnboardingStepLayout from "../_components/OnboardingStepLayout";
import { useIntakeCategories } from "../_hooks/use-intake-catalog";
import { prefetchMedicinesForCategory } from "../_lib/intake-query";
import { getNextStepPath } from "../_lib/onboarding-navigation";
import { useOnboarding } from "../_lib/onboarding-store";

export default function GoalPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { state, updateState, hydrated } = useOnboarding();
  const [selected, setSelected] = useState(state.goalId ?? "");
  const [saving, setSaving] = useState(false);
  const { data: categories = [], isLoading } = useIntakeCategories();

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

    setSaving(true);
    const result = await saveIntakeCategory(selected);
    setSaving(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    const patch = {
      goalId: selected,
      goalName: result.data.goalName,
      medicationId: null,
      requiresQuestionnaire: false,
      questionnaireAnswers: {},
      questionnaireComplete: false,
      selectedPackageId: null,
      eligibilityResult: null,
      checkoutConfirmed: false,
    };
    updateState(patch);
    await prefetchMedicinesForCategory(queryClient, selected);
    const next = getNextStepPath("/onboarding/goal", { ...state, ...patch });
    if (next) router.push(next);
  }

  return (
    <OnboardingShell>
      <OnboardingStepLayout
        title="Choose your health goal."
        description=""
        onContinue={handleContinue}
        continueDisabled={!selected || saving || isLoading}
        continueLabel="Continue"
        showBack={false}
        variant="bare"
        align="center"
        maxWidth="4xl"
        layout="fill"
      >
        <div className="mx-auto grid w-full grid-cols-2 justify-items-center gap-x-4 gap-y-6 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-8">
          {categories.map((goal) => (
            <GoalOptionCard
              key={goal.slug}
              goal={goal}
              selected={hasValidSelection && selected === goal.slug}
              dimmed={hasValidSelection && selected !== goal.slug}
              onClick={() => setSelected(goal.slug)}
            />
          ))}
        </div>
      </OnboardingStepLayout>
    </OnboardingShell>
  );
}
