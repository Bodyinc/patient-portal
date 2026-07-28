"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { saveIntakeMedicine } from "@/lib/actions/intake";

import MedicationCard from "../_components/MedicationCard";
import MedicationDetailsDialog from "../_components/MedicationDetailsDialog";
import OnboardingFooter from "../_components/OnboardingFooter";
import OnboardingFrame from "../_components/OnboardingFrame";
import { useMedicinesForCategory } from "../_hooks/use-intake-catalog";
import { prefetchPackagesForMedicine } from "../_lib/intake-query";
import {
  getNextStepPath,
  getPrevStepPath,
  pushOnboardingRoute,
} from "../_lib/onboarding-navigation";
import { useOnboarding } from "../_lib/onboarding-store";

export default function MedicationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { state, updateState, hydrated } = useOnboarding();
  const [selected, setSelected] = useState(state.medicationId ?? "");
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(state.variantId);
  const [detailsMedicationId, setDetailsMedicationId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function selectMedication(id: string, variantId: string | null) {
    setSelected(id);
    setSelectedVariantId(variantId);
  }

  const {
    data: catalog,
    isLoading,
    isError,
    error,
    refetch,
  } = useMedicinesForCategory(state.goalId);

  const medications = catalog?.medicines ?? [];
  const categoryEligible = catalog?.categoryEligible ?? true;
  const ineligibleReason = catalog?.ineligibleReason ?? null;
  const detailsMedication = medications.find((m) => m.id === detailsMedicationId) ?? null;

  useEffect(() => {
    if (!hydrated) return;
    if (state.medicationId) setSelected(state.medicationId);
  }, [hydrated, state.medicationId]);

  async function handleContinue() {
    if (!selected) {
      toast.error("Please select a medication");
      return;
    }

    setSaving(true);
    const result = await saveIntakeMedicine(selected);
    setSaving(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    const patch = {
      medicationId: selected,
      variantId: selectedVariantId,
      questionnaireAnswers: {},
      questionnaireComplete: false,
      selectedPackageId: null,
      eligibilityResult: null,
      checkoutConfirmed: false,
    };
    updateState(patch);
    await prefetchPackagesForMedicine(queryClient, selected, selectedVariantId);
    const next = getNextStepPath("/onboarding/medications", { ...state, ...patch });
    if (next) await pushOnboardingRoute(router, next);
  }

  async function handleBack() {
    const prev = getPrevStepPath("/onboarding/medications", state);
    if (prev) await pushOnboardingRoute(router, prev);
  }

  return (
    <>
      <OnboardingFrame
        footer={
          <OnboardingFooter
            onBack={handleBack}
            onContinue={handleContinue}
            continueDisabled={!selected || saving || isLoading || !categoryEligible}
            variant="figma"
          />
        }
      >
        <div className="mx-auto mb-4 w-full max-w-[980px] shrink-0 text-center onboarding-font sm:mb-6">
          <h1 className="text-[28px] font-medium leading-none tracking-[-0.5px] text-[#152A51] sm:text-[32px]">
            Choose your medication
          </h1>
          <p className="mx-auto mt-3.5 max-w-2xl text-[14px] font-normal leading-snug text-[#152A51]/80">
            {state.goalName
              ? `Recommended options for ${state.goalName}.`
              : "Select the treatment that fits your goals."}
          </p>
        </div>

        <div className="mx-auto flex min-h-0 w-full max-w-[860px] flex-1 flex-col gap-4 overflow-y-auto px-3 pb-2 scrollbar-hide sm:gap-5 sm:px-5">
          {isLoading ? (
            <p className="text-center text-sm text-[#152A51]/70">Loading medications…</p>
          ) : isError ? (
            <div className="text-center">
              <p className="text-sm text-red-600">
                {error instanceof Error ? error.message : "Could not load medications."}
              </p>
              <button
                type="button"
                onClick={() => void refetch()}
                className="mt-2 text-sm font-medium text-[#152A51] underline"
              >
                Try again
              </button>
            </div>
          ) : !categoryEligible ? (
            <div className="rounded-[16px] border border-amber-200 bg-amber-50 px-4 py-4 text-center">
              <p className="text-sm font-medium text-amber-900">
                {ineligibleReason ??
                  "Based on your profile, no medications are available for this goal."}
              </p>
              <p className="mt-1 text-sm text-amber-800">
                Go back to update your demographics or choose a different goal.
              </p>
            </div>
          ) : medications.length === 0 ? (
            <p className="text-center text-sm text-[#152A51]/70">
              No medications are available for this goal right now. Try going back and selecting a
              different goal.
            </p>
          ) : (
            medications.map((medication, index) => (
              <MedicationCard
                key={medication.id}
                medication={medication}
                selected={selected === medication.id}
                accentIndex={index}
                onSelect={selectMedication}
                onViewDetails={setDetailsMedicationId}
              />
            ))
          )}
        </div>
      </OnboardingFrame>

      <MedicationDetailsDialog
        key={detailsMedicationId ?? "none"}
        medication={detailsMedication}
        open={Boolean(detailsMedicationId)}
        onOpenChange={(open) => {
          if (!open) setDetailsMedicationId(null);
        }}
        onSelect={(id, variantId) => {
          selectMedication(id, variantId);
          setDetailsMedicationId(null);
        }}
      />
    </>
  );
}
