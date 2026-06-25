"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import Image from "next/image";
import Link from "next/link";
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
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-white via-purple-50 to-white">
      <Image
        src="/background-curve.svg"
        alt=""
        fill
        className="pointer-events-none object-cover opacity-40"
      />

      <div className="absolute left-8 top-8 z-10">
        <Image src="/logo.svg" alt="BodyInc" width={160} height={50} priority />
      </div>

      <main className="relative z-10 flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <h1 className="text-3xl font-bold text-[#4F1DDB]">Enter Verification Code</h1>

          <p className="mt-4 text-[#4F1DDB]">Enter the {OTP_LENGTH}-digit code sent to</p>

          <p className="mt-2 font-semibold text-[#4F1DDB]">{email}</p>

          <Link href="/otp-login" className="mt-2 block text-sm text-[#4F1DDB] underline">
            Change email
          </Link>

          <div className="mt-8 flex justify-center gap-2">
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

          <Button
            className="mt-6 w-full bg-[#4F1DDB] hover:bg-[#4420c9]"
            onClick={verify}
            disabled={busy}
          >
            {busy ? "Verifying…" : "Verify"}
          </Button>

          <p className="mt-6 text-sm text-[#4F1DDB]">
            Didn't receive the code?{" "}
            <button type="button" onClick={resend} className="font-semibold underline">
              Resend code
            </button>
          </p>
        </div>
      </main>
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
