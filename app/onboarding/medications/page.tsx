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
    void prefetchPackagesForMedicine(queryClient, id, variantId);
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

    if (state.medicationId === selected) {
      if (state.variantId !== selectedVariantId) {
        updateState({ variantId: selectedVariantId });
      }
      const next = getNextStepPath("/onboarding/medications", {
        ...state,
        medicationId: selected,
        variantId: selectedVariantId,
      });
      if (next) pushOnboardingRoute(router, next);
      return;
    }

    setSaving(true);
    const savePromise = saveIntakeMedicine(selected);

    const patch = {
      medicationId: selected,
      variantId: selectedVariantId,
      selectedPackageId: null,
      checkoutConfirmed: false,
    };
    updateState(patch);
    const next = getNextStepPath("/onboarding/medications", { ...state, ...patch });
    if (next) pushOnboardingRoute(router, next);

    const result = await savePromise;

    if (!result.ok) {
      toast.error(result.message);
      pushOnboardingRoute(router, "/onboarding/medications");
    }
  }

  return (
    <>
      <OnboardingFrame
        footer={
          <OnboardingFooter
            backHref={getPrevStepPath("/onboarding/medications", state)}
            onContinue={handleContinue}
            continueDisabled={!selected || saving || isLoading || !categoryEligible}
            variant="figma"
          />
        }
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden scrollbar-hide">
          <div className="mx-auto mb-4 w-full min-w-0 max-w-[1220px] shrink-0 px-4 text-center onboarding-font sm:mb-6 sm:px-6">
            <h1 className="text-[28px] font-medium leading-none tracking-[-0.5px] text-[#152A51] sm:text-[32px]">
              Choose your medication
            </h1>
            <p className="mx-auto mt-3.5 max-w-2xl text-[14px] font-normal leading-snug text-[#152A51]/80">
              {state.goalName
                ? `Recommended options for ${state.goalName}.`
                : "Select the treatment that fits your goals."}
            </p>
          </div>

          <div className="mx-auto grid w-full min-w-0 max-w-[1220px] grid-cols-1 items-stretch gap-5 px-4 pb-4 pt-2 sm:grid-cols-2 sm:gap-6 sm:px-6 xl:grid-cols-3">
            {isLoading ? (
              <p className="col-span-full text-center text-sm text-[#152A51]/70">
                Loading medications…
              </p>
            ) : isError ? (
              <div className="col-span-full text-center">
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
              <div className="col-span-full rounded-[16px] border border-amber-200 bg-amber-50 px-4 py-4 text-center">
                <p className="text-sm font-medium text-amber-900">
                  {ineligibleReason ??
                    "Based on your profile, no medications are available for this goal."}
                </p>
                <p className="mt-1 text-sm text-amber-800">
                  Go back to update your demographics or choose a different goal.
                </p>
              </div>
            ) : medications.length === 0 ? (
              <p className="col-span-full text-center text-sm text-[#152A51]/70">
                No medications are available for this goal right now. Try going back and selecting a
                different goal.
              </p>
            ) : (
              medications.map((medication, index) => (
                <div key={medication.id} className="flex h-full min-w-0 justify-center">
                  <MedicationCard
                    medication={medication}
                    selected={selected === medication.id}
                    activeVariantId={selected === medication.id ? selectedVariantId : null}
                    accentIndex={index}
                    onSelect={selectMedication}
                    onViewDetails={setDetailsMedicationId}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </OnboardingFrame>

      <MedicationDetailsDialog
        key={`${detailsMedicationId ?? "none"}-${
          detailsMedicationId && selected === detailsMedicationId ? (selectedVariantId ?? "") : ""
        }`}
        medication={detailsMedication}
        open={Boolean(detailsMedicationId)}
        initialVariantId={
          detailsMedicationId && selected === detailsMedicationId ? selectedVariantId : null
        }
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
