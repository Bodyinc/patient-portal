"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import AuthPageShell, {
  AuthHeading,
  authButtonClassName,
  authInputClassName,
} from "@/components/AuthPageShell";
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
    <AuthPageShell footer={null}>
      <div className="text-center">
        {sent ? (
          <>
            <AuthHeading
              title="Check Your Email"
              description="We've sent a password reset link to your email address."
            />

            <Link
              href="/auth"
              className="inline-block text-base text-[#2E00AB] underline underline-offset-4 sm:text-[18px]"
            >
              ← Back to login options
            </Link>
          </>
        ) : (
          <>
            <AuthHeading
              title="Reset Password"
              description="Enter your email address below and we'll send you a link to reset your password."
            />

            <form onSubmit={onSubmit} className="text-left">
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
                  className={authInputClassName}
                  required
                />
              </div>

              <Button type="submit" disabled={busy} className={`mt-6 ${authButtonClassName}`}>
                {busy ? "Sending..." : "Send Reset Link"}
              </Button>

              <p className="mt-6 break-words text-center text-sm leading-snug text-[#2E00AB] sm:text-base">
                Can&apos;t access your email?{" "}
                <Link href="/support" className="font-semibold underline underline-offset-4">
                  Contact support
                </Link>{" "}
                for assistance.
              </p>

              <div className="mt-8 text-center">
                <Link
                  href="/auth"
                  className="text-base text-[#2E00AB] underline underline-offset-4 sm:text-[18px]"
                >
                  ← Back to login options
                </Link>
              </div>
            </form>
          </>
        )}
      </div>
    </AuthPageShell>
  );
}
