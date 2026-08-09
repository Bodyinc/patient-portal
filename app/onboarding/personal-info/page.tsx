"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { z } from "zod";

import Link from "next/link";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveIntakeContact } from "@/lib/actions/intake";
import { checkPatientEmail } from "@/lib/actions/patient-auth";
import { wrongPortalMessage } from "@/lib/auth/constants";

import OnboardingStepLayout from "../_components/OnboardingStepLayout";
import {
  getNextStepPath,
  getPrevStepPath,
  pushOnboardingRoute,
} from "../_lib/onboarding-navigation";
import { useOnboarding } from "../_lib/onboarding-store";

const personalInfoSchema = z
  .object({
    fullName: z.string().trim().min(1, "Enter your full name").max(120),
    email: z.string().trim().email("Enter a valid email").max(255),
    confirmEmail: z.string().trim().email("Confirm your email").max(255),
  })
  .refine((data) => data.email.toLowerCase() === data.confirmEmail.toLowerCase(), {
    message: "Emails do not match",
    path: ["confirmEmail"],
  });

const fieldLabelClass = "text-[14px] font-normal leading-none text-[#152A51]";

const fieldControlClass =
  "h-[45px] rounded-[14px] border-0 bg-[#E8EEED] px-4 text-[14px] font-normal leading-none text-[#152A51] shadow-none " +
  "placeholder:text-[#152A51]/40 " +
  "focus:border-0 focus:ring-0 focus-visible:border-0 focus-visible:ring-0 focus-visible:outline-none";

export default function PersonalInfoPage() {
  const router = useRouter();
  const { state, updateState, hydrated } = useOnboarding();
  const [saving, setSaving] = useState(false);
  const [emailError, setEmailError] = useState<ReactNode | null>(null);
  const [form, setForm] = useState({
    fullName: state.fullName,
    email: state.email,
    confirmEmail: state.email,
  });

  useEffect(() => {
    if (!hydrated) return;
    setForm({
      fullName: state.fullName,
      email: state.email,
      confirmEmail: state.email,
    });
  }, [hydrated, state.fullName, state.email]);

  async function handleContinue() {
    setEmailError(null);
    const parsed = personalInfoSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    setSaving(true);

    // Onboarding is for NEW patients only. Block an email that already has an account
    // (surface it inline under the field) and send them to log in instead.
    const check = await checkPatientEmail(parsed.data.email);
    if (check.status === "patient") {
      setSaving(false);
      setEmailError(
        <>
          An account with this email already exists.{" "}
          <Link href="/auth" className="font-semibold underline underline-offset-2">
            Log in instead
          </Link>
          .
        </>,
      );
      return;
    }
    if (check.status === "wrong_portal") {
      setSaving(false);
      setEmailError(wrongPortalMessage(check.role));
      return;
    }
    if (check.status === "invalid" || check.status === "error") {
      setSaving(false);
      setEmailError("Could not verify that email. Please try again.");
      return;
    }

    // Phone is collected on delivery-address — do not forward leftover state.phone here or
    // saveIntakeContact will reject it with "Enter a valid phone number".
    const contact = {
      fullName: parsed.data.fullName,
      email: parsed.data.email,
    };
    const result = await saveIntakeContact(contact);
    setSaving(false);

    if (!result.ok) {
      if (result.code === "email_exists" || result.code === "wrong_portal") {
        setEmailError(result.message);
        return;
      }
      toast.error(result.message);
      return;
    }

    updateState(contact);
    // Next step is shipping; medicine/packages come later in the flow.
    const next = getNextStepPath("/onboarding/personal-info", { ...state, ...contact });
    if (next) await pushOnboardingRoute(router, next);
  }

  async function handleBack() {
    const prev = getPrevStepPath("/onboarding/personal-info", state);
    if (prev) await pushOnboardingRoute(router, prev);
  }

  return (
    <OnboardingStepLayout
      title="Personal information"
      onBack={handleBack}
      onContinue={handleContinue}
      continueDisabled={saving}
      continueLabel="Continue"
      maxWidth="form"
      variant="bare"
      align="center"
    >
      <div className="space-y-6 text-left">
        {/* Figma: clinician photo + assessment complete banner */}
        <div className="mx-auto flex w-fit items-center gap-4">
          <div className="relative h-[123px] w-[100px] shrink-0 overflow-hidden rounded-[11px]">
            <img src="/woman.png" alt="" className="h-full w-full object-cover object-center" />
          </div>
          <div className="max-w-[270px] space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#6A9B9C] px-3 py-1.5 text-[12px] font-medium leading-none text-white sm:text-[13px]">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/20">
                <Check className="h-2.5 w-2.5 stroke-[3]" aria-hidden />
              </span>
              Your assessment is complete
            </span>
            <p className="text-[13px] font-normal leading-snug text-[#152A51]/80 sm:text-[14px]">
              You&apos;re one step away from viewing your treatment recommendations.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <Label htmlFor="fullName" className={fieldLabelClass}>
            Full name
          </Label>
          <Input
            id="fullName"
            autoFocus
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
            placeholder="John Doe"
            className={fieldControlClass}
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2 sm:gap-4">
          <div className="space-y-4">
            <Label htmlFor="email" className={fieldLabelClass}>
              Email address
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => {
                setEmailError(null);
                setForm((f) => ({ ...f, email: e.target.value }));
              }}
              placeholder="email@example.com"
              className={fieldControlClass}
              aria-invalid={emailError ? true : undefined}
            />
            {emailError ? <p className="text-sm text-red-600">{emailError}</p> : null}
          </div>

          <div className="space-y-4">
            <Label htmlFor="confirmEmail" className={fieldLabelClass}>
              Confirm email
            </Label>
            <Input
              id="confirmEmail"
              type="email"
              autoComplete="email"
              value={form.confirmEmail}
              onChange={(e) => setForm((f) => ({ ...f, confirmEmail: e.target.value }))}
              placeholder="email@example.com"
              className={fieldControlClass}
            />
          </div>
        </div>
      </div>
    </OnboardingStepLayout>
  );
}
