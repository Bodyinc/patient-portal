"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveIntakeContact } from "@/lib/actions/intake";

import OnboardingShell from "../_components/OnboardingShell";
import OnboardingStepLayout from "../_components/OnboardingStepLayout";
import { prefetchQuestionnaireAndPackages } from "../_lib/intake-query";
import { getNextStepPath, getPrevStepPath } from "../_lib/onboarding-navigation";
import { useOnboarding } from "../_lib/onboarding-store";

const personalInfoSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your full name").max(120),
  email: z.string().trim().email("Enter a valid email"),
  phone: z.string().trim().min(7, "Enter a valid phone number").max(32),
});

export default function PersonalInfoPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { state, updateState, hydrated } = useOnboarding();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    fullName: state.fullName,
    email: state.email,
    phone: state.phone,
  });

  useEffect(() => {
    if (!hydrated) return;
    setForm({
      fullName: state.fullName,
      email: state.email,
      phone: state.phone,
    });
  }, [hydrated, state.fullName, state.email, state.phone]);

  async function handleContinue() {
    const parsed = personalInfoSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    setSaving(true);
    const result = await saveIntakeContact(parsed.data);
    setSaving(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    updateState(parsed.data);
    if (state.medicationId) {
      await prefetchQuestionnaireAndPackages(queryClient, state.medicationId);
    }
    const next = getNextStepPath("/onboarding/personal-info", { ...state, ...parsed.data });
    if (next) router.push(next);
  }

  function handleBack() {
    const prev = getPrevStepPath("/onboarding/personal-info", state);
    if (prev) router.push(prev);
  }

  return (
    <OnboardingShell>
      <OnboardingStepLayout
        title="Personal information"
        description="We'll use this to set up your account and contact you about your treatment."
        onBack={handleBack}
        onContinue={handleContinue}
        continueDisabled={saving}
        maxWidth="2xl"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName" className="text-[#2E00AB]">
              Full name
            </Label>
            <Input
              id="fullName"
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              placeholder="John Doe"
              className="border-[#2E00AB]/20"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-[#2E00AB]">
              Email address
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="name@company.com"
              className="border-[#2E00AB]/20"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="text-[#2E00AB]">
              Phone number
            </Label>
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="(555) 000-0000"
              className="border-[#2E00AB]/20"
            />
          </div>
        </div>
      </OnboardingStepLayout>
    </OnboardingShell>
  );
}
