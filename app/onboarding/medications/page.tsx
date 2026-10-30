"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { saveIntakeMedicine } from "@/lib/actions/intake";
import { userFacingMessage } from "@/lib/user-message";

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

  const medications = useMemo(() => catalog?.medicines ?? [], [catalog?.medicines]);
  const medicationKey = medications.map((medicine) => medicine.id).join(",");

  useEffect(() => {
    if (!hydrated || medications.length === 0) return;
    const saved = medications.find((medicine) => medicine.id === state.medicationId) ?? null;
    const target = saved ?? (medications.length === 1 ? medications[0] : null);
    if (!target) return;

    const defaultVariant = target.variants.length
      ? [...target.variants].sort(
          (a, b) => (a.fromPriceCents ?? Infinity) - (b.fromPriceCents ?? Infinity),
        )[0].id
      : null;
    const variantId = saved ? (state.variantId ?? defaultVariant) : defaultVariant;
    setSelected(target.id);
    setSelectedVariantId(variantId);
    void prefetchPackagesForMedicine(queryClient, target.id, variantId);
  }, [hydrated, medicationKey, medications, queryClient, state.medicationId, state.variantId]);
  const categoryEligible = catalog?.categoryEligible ?? true;
  const ineligibleReason = catalog?.ineligibleReason ?? null;
  const detailsMedication = medications.find((m) => m.id === detailsMedicationId) ?? null;

  async function handleContinue() {
    if (!selected) {
      toast.error("Please select a medication");
      return;
    }

    setSaving(true);
    const savePromise = saveIntakeMedicine(selected, state.goalId, selectedVariantId);

    const patch = {
      medicationId: selected,
      variantId: selectedVariantId,
      additionalProductsReviewed: false,
      selectedPackageId: null,
      checkoutConfirmed: false,
    };
    updateState(patch);
    const next = getNextStepPath("/onboarding/medications", { ...state, ...patch });
    if (next) pushOnboardingRoute(router, next);

    const result = await savePromise;

    if (!result.ok) {
      setSaving(false);
      toast.error(result.message);
      updateState({
        medicationId: state.medicationId,
        variantId: state.variantId,
        additionalProductsReviewed: state.additionalProductsReviewed,
        selectedPackageId: state.selectedPackageId,
        checkoutConfirmed: state.checkoutConfirmed,
      });
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
            <h1 className="pt-6 text-[28px] font-medium leading-none tracking-[-0.5px] text-[#152A51] sm:pt-8 sm:text-[32px]">
              Your medications
            </h1>
            <p className="mx-auto mt-3.5 max-w-2xl text-[14px] font-normal leading-snug text-[#152A51]/80">
              {state.goalName
                ? `Choose a treatment for ${state.goalName}.`
                : "Choose a treatment for your selected goal."}
            </p>
          </div>

          <div className="mx-auto grid w-full min-w-0 max-w-[1220px] grid-cols-1 justify-items-center gap-4 px-4 pb-4 pt-2 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
            {isLoading ? (
              <p className="col-span-full text-center text-sm text-[#152A51]/70">
                Loading medications…
              </p>
            ) : isError ? (
              <div className="col-span-full text-center">
                <p className="text-sm text-red-600">
                  {userFacingMessage(
                    error,
                    "We couldn't load treatments. Please refresh and try again.",
                  )}
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
