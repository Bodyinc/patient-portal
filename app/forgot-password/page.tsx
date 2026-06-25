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

      <div className="absolute left-8 top-8 z-10">
        <Image src="/logo.svg" alt="BodyInc" width={160} height={50} priority />
      </div>

      <main className="relative z-10 flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          {sent ? (
            <div>
              <h2 className="text-4xl font-bold text-[#4F1DDB]">Check Your Email</h2>

              <p className="mt-4 text-[#4F1DDB]">
                We've sent a password reset link to your email address.
              </p>

              <Link href="/auth" className="mt-8 block text-[#4F1DDB] underline">
                ← Back to login options
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-4xl font-bold text-[#4F1DDB]">Reset Password</h1>

              <p className="mt-4 text-[#4F1DDB]">
                Enter your email address below and we'll send you a link to reset your password.
              </p>

              <form onSubmit={onSubmit} className="mt-8 space-y-4 text-left">
                <div className="space-y-2">
                  <Label htmlFor="fp-email" className="text-[#4F1DDB]">
                    Email Address
                  </Label>

                  <Input
                    id="fp-email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-[#4F1DDB] hover:bg-[#4420c9]"
                  disabled={busy}
                >
                  {busy ? "Sending..." : "Send Verification Code"}
                </Button>

                <Link href="/auth" className="block text-center text-[#4F1DDB] underline">
                  ← Back to login options
                </Link>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
