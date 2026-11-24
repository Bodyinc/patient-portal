"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RequiredMark } from "@/components/required-mark";
import { createFreeAccountFromIntake, getFreeAccountPreview } from "@/lib/actions/patient-auth";
import { onLoginSuccess } from "@/lib/auth/on-login-success";
import { createClient } from "@/lib/supabase/client";

import OnboardingFooter from "../_components/OnboardingFooter";
import OnboardingFrame from "../_components/OnboardingFrame";
import { pushOnboardingRoute } from "../_lib/onboarding-navigation";
import { fieldControlClass } from "../_lib/onboarding-theme";

export default function CreateFreeAccountPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [alreadySignedIn, setAlreadySignedIn] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await getFreeAccountPreview();
      if (cancelled) return;
      if (!result.ok) {
        setLoadError(result.message);
        setReady(true);
        return;
      }
      setEmail(result.email);
      setAlreadySignedIn(result.alreadySignedIn);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!alreadySignedIn) {
      if (password.length < 8) {
        toast.error("Password must be at least 8 characters");
        return;
      }
      if (password !== confirm) {
        toast.error("Passwords do not match");
        return;
      }
    }

    setBusy(true);
    try {
      const result = await createFreeAccountFromIntake(alreadySignedIn ? undefined : password);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      if (!result.alreadySignedIn) {
        const supabase = createClient();
        const { error } = await supabase.auth.signInWithPassword({
          email: result.email,
          password,
        });
        if (error) {
          toast.error("Account created. Please log in.");
          router.push("/auth");
          return;
        }
      }

      await onLoginSuccess(router, "Account created");
    } finally {
      setBusy(false);
    }
  }

  return (
    <OnboardingFrame
      showProgress={false}
      footer={
        <OnboardingFooter backHref="/onboarding/medications" showContinue={false} variant="figma" />
      }
    >
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-6 onboarding-font sm:px-6">
        <h1 className="text-[28px] font-medium leading-none tracking-[-0.5px] text-[#152A51] sm:text-[32px]">
          Create your free account
        </h1>
        <p className="mt-3 text-[14px] leading-snug text-[#152A51]/80">
          Set a password to save the details you already entered. You can choose a medicine in the
          shop later and add your card at checkout.
        </p>

        {!ready ? (
          <p className="mt-8 text-sm text-[#152A51]/70">Loading your details…</p>
        ) : loadError ? (
          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
            <p>{loadError}</p>
            <button
              type="button"
              onClick={() => pushOnboardingRoute(router, "/onboarding/medications")}
              className="mt-3 font-medium text-[#152A51] underline"
            >
              Back to treatments
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <Label
                htmlFor="free-email"
                className="mb-2 block text-[13px] font-medium text-[#152A51]"
              >
                Email
              </Label>
              <Input
                id="free-email"
                type="email"
                value={email ?? ""}
                readOnly
                className={fieldControlClass}
              />
            </div>

            {alreadySignedIn ? (
              <p className="text-[13px] leading-snug text-[#152A51]/80">
                You are already signed in. Saving will keep this password and store the details from
                the earlier steps on your account.
              </p>
            ) : (
              <>
                <div>
                  <Label
                    htmlFor="free-pw"
                    className="mb-2 block text-[13px] font-medium text-[#152A51]"
                  >
                    Password <RequiredMark />
                  </Label>
                  <Input
                    id="free-pw"
                    type="password"
                    autoComplete="new-password"
                    autoFocus
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className={fieldControlClass}
                  />
                </div>
                <div>
                  <Label
                    htmlFor="free-pw2"
                    className="mb-2 block text-[13px] font-medium text-[#152A51]"
                  >
                    Confirm password <RequiredMark />
                  </Label>
                  <Input
                    id="free-pw2"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Re-enter your password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={8}
                    className={fieldControlClass}
                  />
                </div>
              </>
            )}

            <Button
              type="submit"
              disabled={busy}
              className="h-[46px] w-full rounded-full bg-[#E3E084] text-[14px] font-medium text-[#152A51] hover:bg-[#D9D674]"
            >
              {busy ? "Saving…" : alreadySignedIn ? "Save and continue" : "Create free account"}
            </Button>
          </form>
        )}
      </div>
    </OnboardingFrame>
  );
}
