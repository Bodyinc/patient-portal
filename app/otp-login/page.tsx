"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
import { checkPatientEmail } from "@/lib/actions/patient-auth";
import { wrongPortalMessage } from "@/lib/auth/constants";
import { createClient } from "@/lib/supabase/client";

const emailSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
});

export default function OtpLoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  // Prefill when returning here to correct a typo from the verify-code screen.
  useEffect(() => {
    const prefill = new URLSearchParams(window.location.search).get("email");
    if (prefill) setEmail(prefill);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = emailSchema.safeParse({ email });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid email");
      return;
    }

    setBusy(true);
    try {
      // OTP is a login, not a signup: only send a code to an existing patient. A brand-new
      // email goes into onboarding; a provider/admin email is rejected.
      const check = await checkPatientEmail(parsed.data.email);
      if (check.status === "new") {
        router.push(`/onboarding/goal?email=${encodeURIComponent(parsed.data.email)}`);
        return;
      }
      if (check.status === "wrong_portal") {
        toast.error(wrongPortalMessage(check.role), { duration: 8000 });
        return;
      }
      if (check.status === "invalid" || check.status === "error") {
        toast.error("Could not verify that email. Please try again.");
        return;
      }

      const { error } = await supabase.auth.signInWithOtp({
        email: parsed.data.email,
        options: { shouldCreateUser: false },
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
          <Label htmlFor="otp-email" className="text-[14px] font-semibold text-[#152A51]">
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

      <p className="mt-6 text-center text-sm text-[#152A51]/80">
        Prefer password login?{" "}
        <Link href="/auth" className="font-medium text-[#152A51] hover:underline">
          Back to login
        </Link>
      </p>
    </AuthPageShell>
  );
}
