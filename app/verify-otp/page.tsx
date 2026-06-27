"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";

import AuthPageShell, { AuthHeading, authButtonClassName } from "@/components/AuthPageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OTP_LENGTH } from "@/lib/auth/constants";
import { onLoginSuccess } from "@/lib/auth/on-login-success";
import { createClient } from "@/lib/supabase/client";

function VerifyOTPContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
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

        <div className="mx-auto mt-8 flex max-w-full justify-center gap-1.5 overflow-x-auto sm:mt-10 sm:gap-3">
          {Array.from({ length: OTP_LENGTH }, (_, index) => (
            <Input
              key={index}
              maxLength={1}
              inputMode="numeric"
              value={otp[index] || ""}
              onChange={(e) => {
                const value = e.target.value.slice(-1);
                const otpArray = otp.split("");
                otpArray[index] = value;
                setOtp(otpArray.join(""));
              }}
              className="h-10 w-9 shrink-0 rounded-[8px] border border-[#2E00AB]/40 bg-white p-0 text-center text-lg font-semibold text-[#2E00AB] shadow-none focus:border-[#2E00AB] sm:h-[50px] sm:w-[50px] sm:text-[24px]"
            />
          ))}
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
