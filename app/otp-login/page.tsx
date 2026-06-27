"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import AuthPageShell, {
  AuthHeading,
  authButtonClassName,
  authInputClassName,
} from "@/components/AuthPageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const emailSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
});

export default function OtpLoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = emailSchema.safeParse({ email });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid email");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: parsed.data.email,
      });
      if (error) {
        toast.error(error.message);
        return;
      }

      router.push(`/verify-otp?email=${encodeURIComponent(parsed.data.email)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthPageShell footer={null}>
      <AuthHeading
        title="Login with OTP"
        description="Enter your email and we'll send you a one-time verification code."
      />

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="otp-email" className="text-[14px] font-semibold text-[#2E00AB]">
            Email Address
          </Label>
          <Input
            id="otp-email"
            type="email"
            autoComplete="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={authInputClassName}
            required
          />
        </div>

        <Button type="submit" className={authButtonClassName} disabled={busy}>
          {busy ? "Sending code..." : "Send Code →"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[#2E00AB]/80">
        Prefer password login?{" "}
        <Link href="/auth" className="font-medium text-[#2E00AB] hover:underline">
          Back to login
        </Link>
      </p>
    </AuthPageShell>
  );
}
