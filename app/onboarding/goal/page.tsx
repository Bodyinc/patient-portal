"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import OnboardingShell from "../_components/OnboardingShell";
import OnboardingStepLayout from "../_components/OnboardingStepLayout";
import { GOALS } from "../_lib/onboarding-config";
import { getNextStepPath } from "../_lib/onboarding-navigation";
import { useOnboarding } from "../_lib/onboarding-store";

export default function GoalPage() {
  const router = useRouter();
  const { state, updateState } = useOnboarding();
  const [selected, setSelected] = useState(state.goalId ?? "");

  function handleContinue() {
    if (!selected) {
      toast.error("Please select a goal");
      return;
    }
    updateState({ goalId: selected });
    const next = getNextStepPath("/onboarding/goal", { ...state, goalId: selected });
    if (next) router.push(next);
  }

  return (
    <OnboardingShell>
      <OnboardingStepLayout
        title="What do you want to achieve?"
        description="Choose the primary goal for your treatment plan."
        onContinue={handleContinue}
        continueDisabled={!selected}
        showBack={false}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {GOALS.map((goal) => (
            <button
              key={goal.id}
              type="button"
              onClick={() => setSelected(goal.id)}
              className={`rounded-xl border px-4 py-4 text-left transition-all ${
                selected === goal.id
                  ? "border-[#2E00AB] bg-[#2E00AB]/5"
                  : "border-[#2E00AB]/20 hover:border-[#2E00AB]"
              }`}
            >
              <span className="block text-base font-semibold text-[#2E00AB]">{goal.label}</span>
              <span className="mt-1 block text-sm text-[#2E00AB]/80">{goal.description}</span>
            </button>
          ))}
        </div>
      </OnboardingStepLayout>
    </OnboardingShell>
  );
}
