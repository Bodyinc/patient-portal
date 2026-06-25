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

    {/* Logo */}
    <div className="absolute left-8 top-8 z-10">
      <Image
        src="/logo.svg"
        alt="BodyInc"
        width={160}
        height={50}
        priority
      />
    </div>

    <main className="relative z-10 flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-[502px] text-center">

        {/* Heading */}
        <h1 className="text-[37px] font-bold leading-[100%] tracking-[0] text-[#2E00AB]">
          Enter Verification Code
        </h1>

        {/* Description */}
        <p className="mt-6 text-[20px] font-normal leading-[100%] text-[#2E00AB]">
          Enter the {OTP_LENGTH}-digit code sent to
        </p>

        {/* Email */}
        <p className="mt-5 text-[22px] font-medium leading-[100%] text-[#2E00AB]">
          {email}
        </p>

        {/* Change email */}
        <Link
          href="/otp-login"
          className="mt-5 block text-[18px] font-normal leading-[100%] text-[#2E00AB] underline underline-offset-4"
        >
          Change email
        </Link>

        {/* OTP Boxes */}
        <div className="mt-10 flex justify-center gap-3">
          {Array.from({ length: OTP_LENGTH }, (_, index) => (
            <Input
              key={index}
              maxLength={1}
              value={otp[index] || ""}
              onChange={(e) => {
                const value = e.target.value.slice(-1);
                const otpArray = otp.split("");
                otpArray[index] = value;
                setOtp(otpArray.join(""));
              }}
              className="h-[50px] w-[50px] rounded-[8px] border border-[#2E00AB]/40 bg-white p-0 text-center text-[24px] font-semibold text-[#2E00AB] shadow-none focus:border-[#2E00AB]"
            />
          ))}
        </div>

        {/* Verify Button */}
        <Button
          onClick={verify}
          disabled={busy}
          className="mt-6 h-[56px] w-full rounded-[8px] bg-[#2E00AB] text-[18px] font-semibold hover:bg-[#25008D]"
        >
          {busy ? "Verifying..." : "Verify"}
        </Button>

        {/* Footer */}
        <p className="mt-6 text-[18px] font-normal text-[#2E00AB]">
          Didn't receive the code?{" "}
          <button
            type="button"
            onClick={resend}
            className="font-semibold underline underline-offset-4"
          >
            Resend code
          </button>
        </p>

      </div>
    </main>
  </div>
);}
export default function VerifyOTPPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center" />
      }
    >
      <VerifyOTPContent />
    </Suspense>
  );
}