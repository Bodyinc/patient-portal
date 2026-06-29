"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import OnboardingShell from "../_components/OnboardingShell";
import OnboardingStepLayout from "../_components/OnboardingStepLayout";
import { calculateBmi, getBmiCategory } from "../_lib/bmi";
import { getNextStepPath, getPrevStepPath } from "../_lib/onboarding-navigation";
import { useOnboarding } from "../_lib/onboarding-store";

export default function BmiPage() {
  const router = useRouter();
  const { state, updateState } = useOnboarding();
  const [heightFeet, setHeightFeet] = useState(
    state.heightFeet !== null ? String(state.heightFeet) : "",
  );
  const [heightInches, setHeightInches] = useState(
    state.heightInches !== null ? String(state.heightInches) : "",
  );
  const [weightLbs, setWeightLbs] = useState(
    state.weightLbs !== null ? String(state.weightLbs) : "",
  );

  const bmi = useMemo(() => {
    const feet = Number(heightFeet);
    const inches = Number(heightInches);
    const weight = Number(weightLbs);
    if (!Number.isFinite(feet) || !Number.isFinite(inches) || !Number.isFinite(weight)) return null;
    return calculateBmi(feet, inches, weight);
  }, [heightFeet, heightInches, weightLbs]);

  const bmiCategory = getBmiCategory(bmi);

  function handleContinue() {
    const feet = Number(heightFeet);
    const inches = Number(heightInches);
    const weight = Number(weightLbs);

    if (!Number.isFinite(feet) || feet < 0) {
      toast.error("Enter a valid height in feet");
      return;
    }
    if (!Number.isFinite(inches) || inches < 0 || inches >= 12) {
      toast.error("Enter inches between 0 and 11");
      return;
    }
    if (!Number.isFinite(weight) || weight <= 0) {
      toast.error("Enter a valid weight");
      return;
    }

    const computedBmi = calculateBmi(feet, inches, weight);
    if (computedBmi === null) {
      toast.error("Could not calculate BMI with the values provided");
      return;
    }

    const patch = {
      heightFeet: feet,
      heightInches: inches,
      weightLbs: weight,
      bmi: computedBmi,
    };
    updateState(patch);
    const next = getNextStepPath("/onboarding/bmi", { ...state, ...patch });
    if (next) router.push(next);
  }

  function handleBack() {
    const prev = getPrevStepPath("/onboarding/bmi", state);
    if (prev) router.push(prev);
  }

  return (
    <OnboardingShell>
      <OnboardingStepLayout
        title="Body measurements"
        description="We'll use your height and weight to calculate your BMI for clinical review."
        onBack={handleBack}
        onContinue={handleContinue}
        maxWidth="2xl"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="feet" className="text-[#2E00AB]">
                Height (feet)
              </Label>
              <Input
                id="feet"
                type="number"
                min={0}
                inputMode="numeric"
                value={heightFeet}
                onChange={(e) => setHeightFeet(e.target.value)}
                placeholder="5"
                className="border-[#2E00AB]/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inches" className="text-[#2E00AB]">
                Height (inches)
              </Label>
              <Input
                id="inches"
                type="number"
                min={0}
                max={11}
                inputMode="numeric"
                value={heightInches}
                onChange={(e) => setHeightInches(e.target.value)}
                placeholder="8"
                className="border-[#2E00AB]/20"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="weight" className="text-[#2E00AB]">
              Weight (lbs)
            </Label>
            <Input
              id="weight"
              type="number"
              min={1}
              inputMode="decimal"
              value={weightLbs}
              onChange={(e) => setWeightLbs(e.target.value)}
              placeholder="165"
              className="border-[#2E00AB]/20"
            />
          </div>

          {bmi !== null ? (
            <div className="rounded-xl border border-[#2E00AB]/20 bg-[#F8F4FF] px-4 py-4 text-center">
              <p className="text-sm text-[#2E00AB]/80">Your BMI</p>
              <p className="mt-1 text-3xl font-bold text-[#2E00AB]">{bmi}</p>
              <p className="mt-1 text-sm font-medium text-[#2E00AB]">{bmiCategory}</p>
            </div>
          ) : null}
        </div>
      </OnboardingStepLayout>
    </OnboardingShell>
  );
}
