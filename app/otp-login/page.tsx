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
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-white via-purple-50 to-white">
      {/* Background Shape */}
      <img
        src="/background-curve.svg"
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40"
      />

      {/* Logo */}
      <div className="absolute left-8 top-8">
        <img src="/logo.svg" alt="BodyInc" className="h-12 w-auto" />
      </div>

      {/* Content */}
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-xs text-center">
          <h1 className="text-3xl font-bold text-[#4F1DDB]">Welcome back</h1>

          <p className="mt-4 text-[#4F1DDB]">
            Enter your email to receive a one-time password (OTP) for secure access.
          </p>

          <div className="mt-8 text-left">
            <label className="mb-2 block text-sm font-semibold text-[#4F1DDB]">Email Address</label>

            <Input
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <Button
            onClick={sendOtp}
            disabled={busy}
            className="mt-6 w-full bg-[#4F1DDB] hover:bg-[#4420c9]"
          >
            {busy ? "Sending…" : "Login →"}
          </Button>

          <Link href="/auth" className="mt-6 block text-[#4F1DDB] underline">
            ← Back to login options
          </Link>
        </div>
      </main>
    </div>
  );
}
