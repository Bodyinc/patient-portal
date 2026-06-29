"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import OnboardingShell from "../_components/OnboardingShell";
import OnboardingStepLayout from "../_components/OnboardingStepLayout";
import { SEX_OPTIONS, US_STATES } from "../_lib/onboarding-config";
import { getNextStepPath, getPrevStepPath } from "../_lib/onboarding-navigation";
import { useOnboarding } from "../_lib/onboarding-store";

const demographicsSchema = z.object({
  state: z.string().min(1, "Select your state"),
  sex: z.string().min(1, "Select your sex"),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date of birth"),
});

export default function DemographicsPage() {
  const router = useRouter();
  const { state, updateState } = useOnboarding();
  const [form, setForm] = useState({
    state: state.state ?? "",
    sex: state.sex ?? "",
    dob: state.dob ?? "",
  });

  function handleContinue() {
    const parsed = demographicsSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    if (new Date(parsed.data.dob) >= new Date()) {
      toast.error("Date of birth must be in the past");
      return;
    }

    const nextState = { ...state, ...parsed.data };
    updateState(parsed.data);
    const next = getNextStepPath("/onboarding/demographics", nextState);
    if (next) router.push(next);
  }

  function handleBack() {
    const prev = getPrevStepPath("/onboarding/demographics", state);
    if (prev) router.push(prev);
  }

  return (
    <OnboardingShell>
      <OnboardingStepLayout
        title="Tell us about yourself"
        description="We need a few details to personalize your care and confirm eligibility."
        onBack={handleBack}
        onContinue={handleContinue}
        maxWidth="2xl"
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="state" className="text-[#2E00AB]">
              State
            </Label>
            <Select
              value={form.state}
              onValueChange={(value) => setForm((f) => ({ ...f, state: value }))}
            >
              <SelectTrigger id="state" className="border-[#2E00AB]/20">
                <SelectValue placeholder="Select your state" />
              </SelectTrigger>
              <SelectContent>
                {US_STATES.map((s) => (
                  <SelectItem key={s.code} value={s.code}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-[#2E00AB]">Sex</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {SEX_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, sex: option.id }))}
                  className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                    form.sex === option.id
                      ? "border-[#2E00AB] bg-[#2E00AB]/5 text-[#2E00AB]"
                      : "border-[#2E00AB]/20 text-[#2E00AB]/80"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dob" className="text-[#2E00AB]">
              Date of birth
            </Label>
            <Input
              id="dob"
              type="date"
              value={form.dob}
              onChange={(e) => setForm((f) => ({ ...f, dob: e.target.value }))}
              className="border-[#2E00AB]/20"
            />
          </div>
        </div>
      </OnboardingStepLayout>
    </OnboardingShell>
  );
}
