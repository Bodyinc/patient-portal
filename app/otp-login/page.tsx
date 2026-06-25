"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export default function OTPLoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendOtp() {
    if (!email.trim()) {
      toast.error("Enter your email");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
      if (error) {
        toast.error(error.message);
        return;
      }
      router.push(`/verify-otp?email=${encodeURIComponent(email.trim())}`);
    } finally {
      setBusy(false);
    }
  }

  return (
  <div className="relative min-h-screen overflow-hidden bg-white">
    {/* Background */}
    <img
      src="/background-curve.svg"
      alt=""
      className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40"
    />

    {/* Logo */}
    <div className="absolute left-8 top-8">
      <img
        src="/logo.svg"
        alt="BodyInc"
        className="h-12 w-auto"
      />
    </div>

    {/* Content */}
    <main className="relative z-10 flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-[468px] text-center">
        {/* Heading */}
        <h1 className="text-[37px] font-bold leading-none text-[#2E00AB]">
          Welcome back
        </h1>

        {/* Description */}
        <p className="mx-auto mt-5 max-w-[468px] text-[20px] font-normal leading-[30px] text-[#2E00AB]">
          Enter your email to receive a one-time password (OTP) for secure
          access.
        </p>

        {/* Email */}
        <div className="mt-10 text-left">
          <label className="mb-2 block text-[14px] font-semibold text-[#2E00AB]">
            Email Address
          </label>

          <Input
            type="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-[52px] rounded-md border border-[#F2F2F2] bg-white px-4 text-[15px] shadow-none placeholder:text-[#8C74E8] focus:border-[#2E00AB] focus:ring-0"
          />
        </div>

        {/* Button */}
        <Button
          onClick={sendOtp}
          disabled={busy}
          className="mt-8 h-[52px] w-full rounded-md bg-[#2E00AB] text-[16px] font-semibold hover:bg-[#25008D]"
        >
          {busy ? "Sending..." : "Login →"}
        </Button>

        {/* Back */}
        <Link
          href="/auth"
          className="mt-9 inline-flex items-center gap-1 text-[14px] font-medium text-[#2E00AB] underline underline-offset-4"
        >
          ← Back to login options
        </Link>
      </div>
    </main>
  </div>
);}
