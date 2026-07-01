"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import OnboardingShell from "../_components/OnboardingShell";
import OnboardingFooter from "../_components/OnboardingFooter";
import OnboardingFrame from "../_components/OnboardingFrame";
import PageHeader from "./components/PageHeader";
import PlanToggle from "./components/PlanToggle";
import PricingCard from "./components/PricingCard";
import { getNextStepPath, getPrevStepPath } from "../_lib/onboarding-navigation";
import { useOnboarding } from "../_lib/onboarding-store";

export default function SelectPlanPage() {
  const router = useRouter();
  const { state, updateState } = useOnboarding();
  const [planMonths, setPlanMonths] = useState(state.planMonths ?? "3");

  function handleContinue() {
    if (!planMonths) {
      toast.error("Please select a plan");
      return;
    }
    updateState({ planMonths });
    const next = getNextStepPath("/onboarding/select-plan", { ...state, planMonths });
    if (next) router.push(next);
  }

  function handleBack() {
    const prev = getPrevStepPath("/onboarding/select-plan", state);
    if (prev) router.push(prev);
  }

  return (
    <OnboardingShell>
      <OnboardingFrame
        footer={<OnboardingFooter onBack={handleBack} onContinue={handleContinue} />}
      >
        <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
          <PageHeader />

          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 sm:gap-4">
            <PlanToggle value={planMonths} onChange={setPlanMonths} />
            <PricingCard planMonths={planMonths} />
            <p className="max-w-xl shrink-0 text-center text-xs text-[#2E00AB]/80 sm:text-sm">
              *Clinical data suggests patients on 3+ month programs see 24% better outcomes on
              average compared to shorter duration.
            </p>
          </div>
        </div>
      </OnboardingFrame>
    </OnboardingShell>
  );
}
