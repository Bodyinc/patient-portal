"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import OnboardingShell from "../_components/OnboardingShell";
import MedicationCard from "../_components/MedicationCard";
import MedicationDetailsDialog from "../_components/MedicationDetailsDialog";
import OnboardingFooter from "../_components/OnboardingFooter";
import OnboardingProgress from "../_components/OnboardingProgress";
import { getGoalById, getMedicationById, getMedicationsForGoal } from "../_lib/onboarding-config";
import { getNextStepPath, getPrevStepPath } from "../_lib/onboarding-navigation";
import { useOnboarding } from "../_lib/onboarding-store";

export default function MedicationsPage() {
  const router = useRouter();
  const { state, updateState } = useOnboarding();
  const [selected, setSelected] = useState(state.medicationId ?? "");
  const [detailsMedicationId, setDetailsMedicationId] = useState<string | null>(null);

  const goal = getGoalById(state.goalId);
  const medications = useMemo(() => getMedicationsForGoal(state.goalId), [state.goalId]);
  const detailsMedication = getMedicationById(detailsMedicationId);

  function handleContinue() {
    if (!selected) {
      toast.error("Please select a medication");
      return;
    }
    updateState({ medicationId: selected, questionnaireAnswers: {} });
    const next = getNextStepPath("/onboarding/medications", {
      ...state,
      medicationId: selected,
      questionnaireAnswers: {},
    });
    if (next) router.push(next);
  }

  function handleBack() {
    const prev = getPrevStepPath("/onboarding/medications", state);
    if (prev) router.push(prev);
  }

  function handleSelect(id: string) {
    setSelected(id);
  }

  return (
    <OnboardingShell>
      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col px-2 lg:px-6">
        <OnboardingProgress />

        <div className="mb-3 shrink-0 text-center sm:mb-4">
          <h1 className="text-2xl font-semibold text-[#2E00AB] sm:text-[28px] lg:text-[32px]">
            Medications for your goal
          </h1>
          <p className="mx-auto mt-2 max-w-3xl text-sm text-[#2E00AB]/80 sm:text-base">
            {goal
              ? `Based on your goal of ${goal.label.toLowerCase()}, here are recommended options.`
              : "Select the treatment that best fits your needs."}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {medications.length === 0 ? (
            <p className="py-8 text-center text-[#2E00AB]/80">
              No medications available for this goal.
            </p>
          ) : (
            <div className="grid grid-cols-1 items-stretch gap-4 pb-2 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
              {medications.map((medication) => (
                <MedicationCard
                  key={medication.id}
                  medication={medication}
                  selected={selected === medication.id}
                  onSelect={handleSelect}
                  onViewDetails={setDetailsMedicationId}
                />
              ))}
            </div>
          )}
        </div>

        <OnboardingFooter
          onBack={handleBack}
          onContinue={handleContinue}
          continueDisabled={!selected}
        />
      </div>

      <MedicationDetailsDialog
        medication={detailsMedication}
        open={detailsMedicationId !== null}
        onOpenChange={(open) => {
          if (!open) setDetailsMedicationId(null);
        }}
        onSelect={handleSelect}
      />
    </OnboardingShell>
  );
}
