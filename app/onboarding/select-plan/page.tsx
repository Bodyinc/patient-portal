"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { saveSelectedPlan } from "@/lib/actions/intake";

import OnboardingShell from "../_components/OnboardingShell";
import OnboardingFooter from "../_components/OnboardingFooter";
import OnboardingFrame from "../_components/OnboardingFrame";
import PageHeader from "./components/PageHeader";
import PlanToggle from "./components/PlanToggle";
import PricingCard from "./components/PricingCard";
import { usePackages } from "../_hooks/use-intake-catalog";
import { invalidateIntakeSummary, prefetchIntakeSummary } from "../_lib/intake-query";
import { getNextStepPath, getPrevStepPath } from "../_lib/onboarding-navigation";
import { useOnboarding } from "../_lib/onboarding-store";

export default function SelectPlanPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { state, updateState, hydrated } = useOnboarding();
  const { data: packages = [], isLoading } = usePackages(state.medicationId, state.variantId);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(
    state.selectedPackageId,
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    if (state.selectedPackageId) setSelectedPackageId(state.selectedPackageId);
  }, [hydrated, state.selectedPackageId]);

  useEffect(() => {
    if (!selectedPackageId && packages.length > 0) {
      const popular = packages.find((p) => p.isMostPopular) ?? packages[packages.length - 1];
      setSelectedPackageId(popular.id);
    }
  }, [packages, selectedPackageId]);

  const selectedPackage = packages.find((p) => p.id === selectedPackageId) ?? null;

  async function handleContinue() {
    if (!selectedPackageId) {
      toast.error("Please select a plan");
      return;
    }

    setSaving(true);
    const result = await saveSelectedPlan(selectedPackageId);
    setSaving(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    updateState({ selectedPackageId, checkoutConfirmed: false });
    await invalidateIntakeSummary(queryClient);
    await prefetchIntakeSummary(queryClient);
    const next = getNextStepPath("/onboarding/select-plan", {
      ...state,
      selectedPackageId,
    });
    if (next) router.push(next);
  }

  function handleBack() {
    const prev = getPrevStepPath("/onboarding/select-plan", state);
    if (prev) router.push(prev);
  }

  return (
    <OnboardingShell>
      <OnboardingFrame
        footer={
          <OnboardingFooter
            onBack={handleBack}
            onContinue={handleContinue}
            continueDisabled={!selectedPackageId || saving || isLoading}
          />
        }
      >
        <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col overflow-y-auto px-1 pb-4 scrollbar-thin">
          <PageHeader />

          <div className="flex flex-1 flex-col items-center justify-start gap-4 pt-2 sm:gap-6 md:justify-center md:pt-0">
            <PlanToggle
              packages={packages}
              selectedPackageId={selectedPackageId}
              onChange={setSelectedPackageId}
            />

            <PricingCard pkg={selectedPackage} />

            <p className="mt-2 max-w-xl text-center text-xs text-[#2E00AB]/80 sm:text-sm">
              *Clinical data suggests patients on 3+ month programs see 24% better outcomes on
              average compared to shorter duration.
            </p>
          </div>
        </div>
      </OnboardingFrame>
    </OnboardingShell>
  );
}
