"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";

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
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-md rounded-lg border bg-white p-8 text-center shadow-sm">
        <h1 className="mb-2 text-3xl font-bold">Enter Verification Code</h1>
        <p className="mb-2 text-sm text-gray-500">Enter the code sent to</p>
        <p className="mb-6 font-medium">{email}</p>

        <div className="flex justify-center gap-2">
          {Array.from({ length: OTP_LENGTH }, (_, index) => (
            <Input
              key={index}
              maxLength={1}
              className="h-12 w-12 text-center text-lg font-semibold"
              value={otp[index] || ""}
              onChange={(e) => {
                const value = e.target.value.slice(-1);
                const otpArray = otp.split("");
                otpArray[index] = value;
                setOtp(otpArray.join(""));
              }}
            />
          ))}
        </div>

        <Button className="mt-4 w-full" onClick={verify} disabled={busy}>
          {busy ? "Verifying…" : "Verify"}
        </Button>
        <button type="button" className="mt-4 text-sm text-gray-500 underline" onClick={resend}>
          Resend Code
        </button>
      </div>
    </div>
  );
}

export default function VerifyOTPPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center" />}>
      <VerifyOTPContent />
    </Suspense>
  );
}
