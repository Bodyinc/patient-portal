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
          href="/otp-login"
          className="mt-4 inline-block text-base text-[#2E00AB] underline underline-offset-4 sm:text-[18px]"
        >
          Change email
        </Link>

        {/* Updated OTP Input with better gap */}
        {/* Custom OTP Input - No library gray line */}
<div className="mx-auto mt-8 flex max-w-full justify-center sm:mt-10">
  <div className="flex gap-1">
    {Array.from({ length: OTP_LENGTH }, (_, index) => (
      <input
        key={index}
        type="text"
        inputMode="numeric"
        maxLength={1}
        value={otp[index] || ""}
        onChange={(e) => {
          const value = e.target.value;
          if (!/^\d*$/.test(value)) return;

          const newOtp = otp.split("");
          newOtp[index] = value;
          const updatedOtp = newOtp.join("");
          setOtp(updatedOtp);

          // Auto focus next input
          if (value && index < OTP_LENGTH - 1) {
            const nextInput = e.target.parentElement?.querySelectorAll("input")[index + 1];
            nextInput?.focus();
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Backspace" && !otp[index] && index > 0) {
            const prevInput = e.currentTarget.parentElement?.querySelectorAll("input")[index - 1];
            prevInput?.focus();
          }
        }}
        className="h-10 w-9 rounded-[8px] border border-[#2E00AB]/40 bg-white text-center text-lg font-semibold text-[#2E00AB] shadow-none focus:border-[#2E00AB] focus:ring-2 focus:ring-[#2E00AB]/30 sm:h-[50px] sm:w-[50px] sm:text-[24px] outline-none"
      />
    ))}
  </div>
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