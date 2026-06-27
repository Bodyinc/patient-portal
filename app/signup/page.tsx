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
import { signUpPatient } from "@/lib/actions/patient-auth";
import { onLoginSuccess } from "@/lib/auth/on-login-success";
import { createClient } from "@/lib/supabase/client";

const signupSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "At least 8 characters").max(72),
  fullName: z.string().trim().min(1, "Required").max(120),
  phone: z.string().trim().max(32).optional(),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter your date of birth"),
});

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    phone: "",
    dob: "",
  });
  const [busy, setBusy] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = signupSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    if (new Date(parsed.data.dob) >= new Date()) {
      toast.error("Date of birth must be in the past");
      return;
    }
    setBusy(true);
    try {
      const result = await signUpPatient(parsed.data);
      if (!result.ok) {
        toast.error(result.message, { duration: 8000 });
        return;
      }
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (signInErr) {
        toast.success("Account created. Please log in.");
        router.push("/auth");
        return;
      }
      await onLoginSuccess(router, "Account created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sign up");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthPageShell footer={null}>
      <AuthHeading title="Create Account" description="Sign up for your patient portal account." />

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="signup-name">Full name</Label>
          <Input
            id="signup-name"
            value={form.fullName}
            onChange={(e) => update("fullName", e.target.value)}
            className={authInputClassName}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="signup-email">Email</Label>
          <Input
            id="signup-email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            className={authInputClassName}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="signup-password">Password</Label>
          <Input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
            className={authInputClassName}
            required
            minLength={8}
          />
          <p className="text-xs text-muted-foreground">At least 8 characters</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="signup-phone">Phone</Label>
            <Input
              id="signup-phone"
              type="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              className={authInputClassName}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-dob">Date of birth</Label>
            <Input
              id="signup-dob"
              type="date"
              value={form.dob}
              onChange={(e) => update("dob", e.target.value)}
              className={authInputClassName}
              required
            />
          </div>
        </div>
        <Button type="submit" className={authButtonClassName} disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[#2E00AB]/80">
        Already have an account?{" "}
        <Link href="/auth" className="font-medium text-[#2E00AB] hover:underline">
          Log in
        </Link>
      </p>
    </AuthPageShell>
  );
}
