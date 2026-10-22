"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { saveSelectedPlan } from "@/lib/actions/intake";

import OnboardingFooter from "../_components/OnboardingFooter";
import OnboardingFrame from "../_components/OnboardingFrame";
import PageHeader from "./components/PageHeader";
import PlanToggle from "./components/PlanToggle";
import PricingCard from "./components/PricingCard";
import TreatmentSummary from "./components/TreatmentSummary";
import {
  useIntakeSummary,
  useMedicinesForCategory,
  usePackages,
} from "../_hooks/use-intake-catalog";
import { invalidateIntakeSummary } from "../_lib/intake-query";
import {
  getNextStepPath,
  getPrevStepPath,
  pushOnboardingRoute,
} from "../_lib/onboarding-navigation";
import { useOnboarding } from "../_lib/onboarding-store";

export default function SelectPlanPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { state, updateState, hydrated } = useOnboarding();
  const { data: packages = [], isLoading } = usePackages(state.medicationId, state.variantId);
  const { data: catalog } = useMedicinesForCategory(state.goalId);
  const { data: summary } = useIntakeSummary();
  const addedProducts = (summary?.cartItems ?? []).filter((item) => !item.isPrimary);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(
    state.selectedPackageId,
  );
  const [saving, setSaving] = useState(false);

  const selectedMedicine = useMemo(() => {
    if (!state.medicationId) return null;
    return catalog?.medicines.find((m) => m.id === state.medicationId) ?? null;
  }, [catalog?.medicines, state.medicationId]);

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
  const clinicalNote =
    selectedPackage?.clinicalNote?.trim() || selectedMedicine?.notice?.trim() || "";

  async function handleContinue() {
    if (!selectedPackageId) {
      toast.error("Please select a plan");
      return;
    }

    if (state.selectedPackageId === selectedPackageId) {
      const next = getNextStepPath("/onboarding/select-plan", {
        ...state,
        selectedPackageId,
      });
      if (next) pushOnboardingRoute(router, next);
      return;
    }

    setSaving(true);
    const result = await saveSelectedPlan(selectedPackageId, state.medicationId, state.goalId);

    if (!result.ok) {
      setSaving(false);
      toast.error(result.message);
      return;
    }

    updateState({ selectedPackageId, checkoutConfirmed: false });
    void invalidateIntakeSummary(queryClient);
    const next = getNextStepPath("/onboarding/select-plan", {
      ...state,
      selectedPackageId,
    });
    if (next) pushOnboardingRoute(router, next);
  }

  return (
    <OnboardingFrame
      footer={
        <OnboardingFooter
          backHref={getPrevStepPath("/onboarding/select-plan", state)}
          onContinue={handleContinue}
          continueLabel="Continue"
          continueDisabled={!selectedPackageId || saving || isLoading}
          variant="figma"
        />
      }
    >
      <div className="mx-auto flex min-h-0 w-full max-w-[649px] flex-1 flex-col overflow-y-auto scrollbar-hide px-1 pb-4">
        <PageHeader />

        <div className="flex flex-1 flex-col gap-6 sm:gap-8">
          <TreatmentSummary
            medicine={selectedMedicine}
            goalName={state.goalName}
            requiresQuestionnaire={state.requiresQuestionnaire}
          />

          {addedProducts.length > 0 ? (
            <div className="flex flex-col gap-3 onboarding-font">
              <h2 className="text-left text-[16px] font-medium text-[#152A51]">
                Also in this order
              </h2>
              {addedProducts.map((item) => (
                <div
                  key={`${item.categoryId}-${item.medicineId}`}
                  className="rounded-[16px] border border-[#E8EEED] bg-white px-4 py-3"
                >
                  <p className="text-[12px] font-medium uppercase tracking-wide text-[#6A9B9C]">
                    {item.categoryName}
                  </p>
                  <p className="mt-1 text-[15px] font-medium text-[#152A51]">{item.medicineName}</p>
                  {item.packageName ? (
                    <p className="mt-1 text-[13px] text-[#152A51]/70">
                      {item.packageName}
                      {item.packagePrice != null ? ` · $${item.packagePrice.toFixed(2)}` : ""}
                    </p>
                  ) : null}
                </div>
              ))}
              <p className="text-[13px] leading-snug text-[#152A51]/70">
                One consultation covers every treatment.
              </p>
            </div>
          ) : null}

          <PlanToggle
            packages={packages}
            selectedPackageId={selectedPackageId}
            onChange={setSelectedPackageId}
          />

          <PricingCard pkg={selectedPackage} keywords={selectedMedicine?.importantInfo} />

          {clinicalNote ? (
            <p className="text-center text-[12px] font-normal italic leading-snug text-[#152A51]/70 onboarding-font sm:text-[13px]">
              {clinicalNote}
            </p>
          ) : null}
        </div>
      </div>
    </OnboardingFrame>
  );
}
