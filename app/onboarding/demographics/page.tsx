"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
import { cn } from "@/lib/utils";
import { saveIntakeDemographics } from "@/lib/actions/intake";
import { DOB_SCHEMA } from "@/lib/validation";

import OnboardingShell from "../_components/OnboardingShell";
import OnboardingStepLayout from "../_components/OnboardingStepLayout";
import { SEX_OPTIONS, US_STATES } from "../_lib/onboarding-config";
import { getNextStepPath, getPrevStepPath } from "../_lib/onboarding-navigation";
import { useOnboarding } from "../_lib/onboarding-store";

const demographicsSchema = z.object({
  state: z.string().min(1, "Select your state"),
  sex: z.enum(["male", "female", "other"]),
  dob: DOB_SCHEMA,
});

const fieldLabelClass = "text-[14px] font-normal leading-none text-[#152A51]";

const fieldControlClass =
  "h-[45px] rounded-[14px] border-0 bg-[#E8EEED] px-4 text-[14px] font-normal leading-none text-[#152A51] shadow-none " +
  "placeholder:text-[#152A51]/40 data-[placeholder]:text-[#152A51]/40 " +
  "focus:border-0 focus:ring-0 focus-visible:border-0 focus-visible:ring-0 " +
  "focus-visible:outline-none";

export default function DemographicsPage() {
  const router = useRouter();
  const { state, updateState, hydrated } = useOnboarding();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    state: state.state ?? "",
    sex: state.sex ?? "",
    dob: state.dob ?? "",
  });

  useEffect(() => {
    if (!hydrated) return;
    setForm({
      state: state.state ?? "",
      sex: state.sex ?? "",
      dob: state.dob ?? "",
    });
  }, [hydrated, state.state, state.sex, state.dob]);

  async function handleContinue() {
    const parsed = demographicsSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    setSaving(true);
    const result = await saveIntakeDemographics({
      stateCode: parsed.data.state,
      sex: parsed.data.sex,
      dob: parsed.data.dob,
    });
    setSaving(false);

    if (!result.ok) {
      toast.error(result.message);
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
        continueDisabled={saving}
        continueLabel="Continue"
        maxWidth="form"
        variant="bare"
        align="center"
      >
        <div className="space-y-6">
          <div className="space-y-2.5">
            <Label htmlFor="state" className={fieldLabelClass}>
              State
            </Label>
            <Select
              value={form.state}
              onValueChange={(value) => setForm((f) => ({ ...f, state: value }))}
            >
              <SelectTrigger id="state" className={cn(fieldControlClass, "w-full")}>
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

          <div className="space-y-2.5">
            <Label className={fieldLabelClass}>Sex</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {SEX_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, sex: option.id }))}
                  className={cn(
                    "h-[45px] rounded-[14px] px-3 text-[14px] font-normal leading-none transition",
                    form.sex === option.id
                      ? "bg-[#E8EEED] text-[#152A51] ring-1 ring-[#152A51]"
                      : "bg-[#E8EEED] text-[#152A51]/80",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            <Label htmlFor="dob" className={fieldLabelClass}>
              Date of birth
            </Label>
            <Input
              id="dob"
              type="date"
              value={form.dob}
              onChange={(e) => setForm((f) => ({ ...f, dob: e.target.value }))}
              className={fieldControlClass}
            />
          </div>
        </div>
      </OnboardingStepLayout>
    </OnboardingShell>
  );
}
