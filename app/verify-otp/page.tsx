"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";

import AuthPageShell, { AuthHeading, authButtonClassName } from "@/components/AuthPageShell";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { OTP_LENGTH } from "@/lib/auth/constants";
import { onLoginSuccess } from "@/lib/auth/on-login-success";
import { reconcileCheckoutEmail } from "@/lib/actions/patient-auth";
import { createClient } from "@/lib/supabase/client";

function VerifyOTPContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const redirectTo = searchParams.get("redirect");
  const supabase = createClient();
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);

  async function verify() {
    if (otp.length < OTP_LENGTH) {
      toast.error(`Enter the ${OTP_LENGTH}-digit code`);
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: "email",
      });
      if (error) {
        toast.error(error.message);
        return;
      }

      // Email change was verified just now — now propagate it to the profile + Stripe customer.
      if (searchParams.get("sync") === "email") {
        await reconcileCheckoutEmail();
      }

      if (redirectTo && redirectTo.startsWith("/")) {
        toast.success("You're signed in. Continuing your order…");
        router.refresh();
        router.push(redirectTo);
        return;
      }

      await onLoginSuccess(router);
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Code resent");
  }

  return (
    <AuthPageShell footer={null}>
      <div className="text-center">
        <AuthHeading
          title="Enter Verification Code"
          description={`Enter the ${OTP_LENGTH}-digit code sent to`}
        />

        <p className="break-all text-base font-medium text-[#2E00AB] sm:text-lg lg:text-[22px]">
          {email}
        </p>

        <Link
          href={`/change-email${redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`}
          className="mt-4 inline-block text-base text-[#2E00AB] underline underline-offset-4 sm:text-[18px]"
        >
          Change email
        </Link>

        <div className="mx-auto mt-8 flex max-w-full justify-center overflow-x-auto sm:mt-10">
          <InputOTP
            maxLength={OTP_LENGTH}
            value={otp}
            onChange={setOtp}
            inputMode="numeric"
            containerClassName="justify-center gap-1.5 sm:gap-3"
          >
            <InputOTPGroup>
              {Array.from({ length: OTP_LENGTH }, (_, index) => (
                <InputOTPSlot
                  key={index}
                  index={index}
                  className="h-10 w-9 rounded-[8px] border border-[#2E00AB]/40 bg-white text-lg font-semibold text-[#2E00AB] shadow-none first:rounded-[8px] first:border-l last:rounded-[8px] sm:h-[50px] sm:w-[50px] sm:text-[24px]"
                />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>

        <Button onClick={verify} disabled={busy} className={`mt-6 ${authButtonClassName}`}>
          {busy ? "Verifying..." : "Verify"}
        </Button>

        <p className="mt-6 text-base text-[#2E00AB] sm:text-[18px]">
          Didn&apos;t receive the code?{" "}
          <button
            type="button"
            onClick={resend}
            className="font-semibold underline underline-offset-4"
          >
            Resend code
          </button>
        </p>
      </div>
    </AuthPageShell>
  );
}

export default function VerifyOTPPage() {
  return (
    <Suspense fallback={<div className="flex min-h-dvh items-center justify-center" />}>
      <VerifyOTPContent />
    </Suspense>
  );
}
