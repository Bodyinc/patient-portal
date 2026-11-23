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
import { RequiredMark } from "@/components/required-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPatientAccount } from "@/lib/actions/patient-auth";
import { onLoginSuccess } from "@/lib/auth/on-login-success";
import { createClient } from "@/lib/supabase/client";

const signupFormSchema = z
  .object({
    fullName: z.string().trim().min(1, "Enter your full name").max(120, "Enter a shorter name"),
    email: z.string().trim().email("Enter a valid email").max(255),
    password: z.string().min(8, "Password must be at least 8 characters.").max(72),
    confirm: z.string().min(1, "Re-enter your password"),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = signupFormSchema.safeParse({ fullName, email, password, confirm });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the form and try again.");
      return;
    }

    setBusy(true);
    try {
      const result = await createPatientAccount({
        fullName: parsed.data.fullName,
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (error) {
        toast.error("Account created. Please log in.");
        router.push("/auth");
        return;
      }

      await onLoginSuccess(router, "Account created");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthPageShell>
      <AuthHeading
        title="Create your account"
        description="Sign up to manage your care. You can choose a treatment later."
      />

      <form onSubmit={onSubmit} className="space-y-6 sm:space-y-7">
        <div className="space-y-2">
          <Label
            htmlFor="signup-name"
            className="text-[14px] font-semibold leading-5 text-[#152A51]"
          >
            Full name <RequiredMark />
          </Label>
          <Input
            id="signup-name"
            type="text"
            autoComplete="name"
            autoFocus
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your name"
            className={authInputClassName}
            required
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="signup-email"
            className="text-[14px] font-semibold leading-5 text-[#152A51]"
          >
            Email Address <RequiredMark />
          </Label>
          <Input
            id="signup-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
            className={authInputClassName}
            required
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="signup-password"
            className="text-[14px] font-semibold leading-5 text-[#152A51]"
          >
            Password <RequiredMark />
          </Label>
          <Input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className={authInputClassName}
            required
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="signup-confirm"
            className="text-[14px] font-semibold leading-5 text-[#152A51]"
          >
            Confirm password <RequiredMark />
          </Label>
          <Input
            id="signup-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Re-enter your password"
            className={authInputClassName}
            required
          />
        </div>

        <Button type="submit" className={authButtonClassName} disabled={busy}>
          {busy ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <div className="mt-5 space-y-3">
        <p className="text-center text-sm text-[#152A51]/80">
          Already have an account?{" "}
          <Link href="/auth" className="font-medium text-[#152A51] hover:underline">
            Log in
          </Link>
        </p>
        <p className="text-center text-sm text-[#152A51]/80">
          Starting a treatment now?{" "}
          <Link href="/onboarding/goal" className="font-medium text-[#152A51] hover:underline">
            Get started
          </Link>
        </p>
      </div>
    </AuthPageShell>
  );
}
