"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      setSent(true);
    } finally {
      setBusy(false);
    }
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
        <Image src="/logo.svg" alt="BodyInc" width={160} height={50} priority />
      </div>

      <main className="relative z-10 flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-[502px] text-center">
          {sent ? (
            <>
              <h2 className="text-[37px] font-bold leading-none text-[#2E00AB]">
                Check Your Email
              </h2>

              <p className="mt-6 text-[20px] font-normal leading-none text-[#2E00AB]">
                We've sent a password reset link to your email address.
              </p>

              <Link
                href="/auth"
                className="mt-10 inline-block text-[18px] font-normal text-[#2E00AB] underline underline-offset-4"
              >
                ← Back to login options
              </Link>
            </>
          ) : (
            <>
              {/* Heading */}
              <h1 className="text-[37px] font-bold leading-none text-[#2E00AB]">Reset Password</h1>

              {/* Description */}
              <p className="mx-auto mt-6 max-w-[468px] text-[20px] font-normal leading-none text-[#2E00AB]">
                Enter your email address below and we'll send you a link to reset your password.
              </p>

              {/* Form */}
              <form onSubmit={onSubmit} className="mt-10 text-left">
                <div>
                  <Label
                    htmlFor="fp-email"
                    className="mb-2 block text-[14px] font-semibold text-[#2E00AB]"
                  >
                    Email Address
                  </Label>

                  <Input
                    id="fp-email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-[52px] rounded-[8px] border-[#F2F2F2] bg-white px-5 text-[18px] text-[#2E00AB] placeholder:text-[#8C74E8]"
                    required
                  />
                </div>

                {/* Button */}
                <Button
                  type="submit"
                  disabled={busy}
                  className="mt-6 h-[56px] w-full rounded-[8px] bg-[#2E00AB] text-[18px] font-semibold hover:bg-[#25008D]"
                >
                  {busy ? "Sending..." : "Send Reset Link"}
                </Button>

                {/* Support */}
                <p className="mt-6 text-center text-[16px] text-[#2E00AB]">
                  Can't access your email?{" "}
                  <Link href="/support" className="font-semibold underline underline-offset-4">
                    Contact support
                  </Link>{" "}
                  for assistance.
                </p>

                {/* Back */}
                <div className="mt-8 text-center">
                  <Link
                    href="/auth"
                    className="text-[18px] font-normal text-[#2E00AB] underline underline-offset-4"
                  >
                    ← Back to login options
                  </Link>
                </div>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
