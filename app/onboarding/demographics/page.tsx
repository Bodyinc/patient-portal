"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { saveIntakeDemographics } from "@/lib/actions/intake";
import { DOB_SCHEMA } from "@/lib/validation";

import OnboardingDobField from "../_components/OnboardingDobField";
import OnboardingStepLayout from "../_components/OnboardingStepLayout";
import { SEX_OPTIONS, US_STATES } from "../_lib/onboarding-config";
import {
  getNextStepPath,
  getPrevStepPath,
  pushOnboardingRoute,
} from "../_lib/onboarding-navigation";
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
    try {
      const result = await saveIntakeDemographics({
        stateCode: parsed.data.state,
        sex: parsed.data.sex,
        dob: parsed.data.dob,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      const patch = {
        state: parsed.data.state,
        sex: parsed.data.sex,
        dob: parsed.data.dob,
      };
      const nextState = { ...state, ...patch };
      updateState(patch);
      const next = getNextStepPath("/onboarding/demographics", nextState);
      if (next) await pushOnboardingRoute(router, next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save demographics.");
    } finally {
      setSaving(false);
    }
  }

  async function handleBack() {
    const prev = getPrevStepPath("/onboarding/demographics", state);
    if (prev) await pushOnboardingRoute(router, prev);
  }

  return (
    <OnboardingStepLayout
      title="We need to make sure we can support you"
      description="*Required fields are marked with ."
      onBack={handleBack}
      onContinue={handleContinue}
      continueDisabled={saving}
      continueLabel="Continue"
      maxWidth="form"
      variant="bare"
      align="center"
    >
      <div className="space-y-6">
        <div className="space-y-4">
          <Label htmlFor="state" className={fieldLabelClass}>
            State
          </Label>
          <Select
            value={form.state || undefined}
            onValueChange={(value) => {
              if (!value) return;
              setForm((f) => ({ ...f, state: value }));
            }}
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

        <div className="space-y-4">
          <Label htmlFor="sex" className={fieldLabelClass}>
            Sex
          </Label>
          <Select
            value={form.sex || undefined}
            onValueChange={(value) => {
              if (!value) return;
              setForm((f) => ({ ...f, sex: value }));
            }}
          >
            <SelectTrigger id="sex" className={cn(fieldControlClass, "w-full")}>
              <SelectValue placeholder="Select your sex" />
            </SelectTrigger>
            <SelectContent>
              {SEX_OPTIONS.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-4">
          <Label htmlFor="dob" className={fieldLabelClass}>
            Date of birth
          </Label>
          <OnboardingDobField
            id="dob"
            value={form.dob}
            onChange={(dob) => setForm((f) => ({ ...f, dob }))}
            inputClassName={fieldControlClass}
          />
        </div>
      </div>
    </OnboardingStepLayout>
  );
}
