"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { saveIntakeCategory } from "@/lib/actions/intake";

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
        title="What do you want to achieve?"
        description="Choose the primary goal for your treatment plan."
        onContinue={handleContinue}
        continueDisabled={!selected || saving || isLoading}
        showBack={false}
      >
        <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
          {categories.map((goal) => (
            <button
              key={goal.slug}
              type="button"
              onClick={() => setSelected(goal.slug)}
              className={`rounded-xl border px-3 py-3 text-left transition-all sm:px-4 sm:py-3.5 ${
                selected === goal.slug
                  ? "border-[#2E00AB] bg-[#2E00AB]/5"
                  : "border-[#2E00AB]/20 hover:border-[#2E00AB]"
              }`}
            >
              <span className="block text-base font-semibold text-[#2E00AB]">{goal.name}</span>
              <span className="mt-1 block text-sm text-[#2E00AB]/80">
                {goal.tagline ?? goal.description ?? ""}
              </span>
            </button>
          ))}
        </div>
      </OnboardingStepLayout>
    </OnboardingShell>
  );
}
