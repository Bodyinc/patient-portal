"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Ruler, Weight } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { saveIntakeBmi } from "@/lib/actions/intake";

import BmiGauge from "../_components/BmiGauge";
import OnboardingStepLayout from "../_components/OnboardingStepLayout";
import { calculateBmi, getBmiCategory } from "../_lib/bmi";
import {
  getNextStepPath,
  getPrevStepPath,
  pushOnboardingRoute,
} from "../_lib/onboarding-navigation";
import { useOnboarding } from "../_lib/onboarding-store";

const fieldLabelClass = "text-[14px] font-normal leading-none text-[#152A51]";

const fieldControlClass =
  "h-[45px] rounded-[14px] border-0 bg-[#E8EEED] px-4 text-[14px] font-normal leading-none text-[#152A51] shadow-none " +
  "placeholder:text-[#152A51]/40 " +
  "focus:border-0 focus:ring-0 focus-visible:border-0 focus-visible:ring-0 focus-visible:outline-none";

export default function BmiPage() {
  const router = useRouter();
  const { state, updateState, hydrated } = useOnboarding();
  const [saving, setSaving] = useState(false);
  const [heightFeet, setHeightFeet] = useState(
    state.heightFeet !== null ? String(state.heightFeet) : "",
  );
  const [heightInches, setHeightInches] = useState(
    state.heightInches !== null ? String(state.heightInches) : "",
  );
  const [weightLbs, setWeightLbs] = useState(
    state.weightLbs !== null ? String(state.weightLbs) : "",
  );

  useEffect(() => {
    if (!hydrated) return;
    setHeightFeet(state.heightFeet !== null ? String(state.heightFeet) : "");
    setHeightInches(state.heightInches !== null ? String(state.heightInches) : "");
    setWeightLbs(state.weightLbs !== null ? String(state.weightLbs) : "");
  }, [hydrated, state.heightFeet, state.heightInches, state.weightLbs]);

  const bmi = useMemo(() => {
    const feet = Number(heightFeet);
    const inches = Number(heightInches);
    const weight = Number(weightLbs);
    if (!Number.isFinite(feet) || !Number.isFinite(inches) || !Number.isFinite(weight)) return null;
    return calculateBmi(feet, inches, weight);
  }, [heightFeet, heightInches, weightLbs]);

  const bmiCategory = getBmiCategory(bmi);

  async function handleContinue() {
    const feet = Number(heightFeet);
    const inches = Number(heightInches);
    const weight = Number(weightLbs);

    if (!Number.isFinite(feet) || feet < 1 || feet > 8) {
      toast.error("Enter a valid height in feet");
      return;
    }
    if (!Number.isFinite(inches) || inches < 0 || inches >= 12) {
      toast.error("Enter inches between 0 and 11");
      return;
    }
    if (!Number.isFinite(weight) || weight <= 0 || weight > 1500) {
      toast.error("Enter a valid weight");
      return;
    }

    const computedBmi = calculateBmi(feet, inches, weight);
    if (computedBmi === null) {
      toast.error("Could not calculate BMI with the values provided");
      return;
    }

    setSaving(true);
    const result = await saveIntakeBmi({
      heightFeet: feet,
      heightInches: inches,
      weightLbs: weight,
    });
    setSaving(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    const patch = {
      heightFeet: feet,
      heightInches: inches,
      weightLbs: weight,
      bmi: result.data.bmi,
    };
    updateState(patch);
    const next = getNextStepPath("/onboarding/bmi", { ...state, ...patch });
    if (next) await pushOnboardingRoute(router, next);
  }

  async function handleBack() {
    const prev = getPrevStepPath("/onboarding/bmi", state);
    if (prev) await pushOnboardingRoute(router, prev);
  }

  return (
    <OnboardingStepLayout
      title="Let's understand your starting point."
      description="These measurements help us personalize your treatment recommendations."
      onBack={handleBack}
      onContinue={handleContinue}
      continueDisabled={saving}
      continueLabel="Continue"
      maxWidth="form"
      variant="bare"
      align="center"
    >
      <div className="space-y-6">
        <div className="space-y-2.5 text-left">
          <Label className={fieldLabelClass}>Height</Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <Ruler
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#152A51]/40"
                aria-hidden
              />
              <Input
                id="feet"
                type="number"
                min={1}
                max={8}
                inputMode="numeric"
                value={heightFeet}
                onChange={(e) => setHeightFeet(e.target.value)}
                placeholder="Feet"
                aria-label="Height (feet)"
                className={cn(fieldControlClass, "pl-9 pr-12")}
              />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[12px] text-[#152A51]/40">
                ft
              </span>
            </div>
            <div className="relative">
              <Ruler
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#152A51]/40"
                aria-hidden
              />
              <Input
                id="inches"
                type="number"
                min={0}
                max={11}
                inputMode="numeric"
                value={heightInches}
                onChange={(e) => setHeightInches(e.target.value)}
                placeholder="Inches"
                aria-label="Height (inches)"
                className={cn(fieldControlClass, "pl-9 pr-12")}
              />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[12px] text-[#152A51]/40">
                in
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-2.5 text-left">
          <Label htmlFor="weight" className={fieldLabelClass}>
            Current weight
          </Label>
          <div className="relative">
            <Weight
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#152A51]/40"
              aria-hidden
            />
            <Input
              id="weight"
              type="number"
              min={1}
              max={1500}
              inputMode="decimal"
              value={weightLbs}
              onChange={(e) => setWeightLbs(e.target.value)}
              placeholder="Weight"
              className={cn(fieldControlClass, "pl-9 pr-12")}
            />
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[12px] text-[#152A51]/40">
              lbs
            </span>
          </div>
        </div>

        {bmi !== null ? <BmiGauge bmi={bmi} category={bmiCategory} /> : null}
      </div>
    </OnboardingStepLayout>
  );
}
