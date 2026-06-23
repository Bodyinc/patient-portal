"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUpPatient } from "@/lib/actions/patient-auth";
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
      toast.success("Account created");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sign up");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="border-b bg-white px-8 py-4">
        <h1 className="text-lg font-semibold">BodyInc</h1>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-lg border bg-white p-8 shadow-sm">
          <div className="mb-6 text-center">
            <h2 className="text-3xl font-bold">Create Account</h2>
            <p className="mt-2 text-gray-500">Sign up for your patient portal account.</p>
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signup-name">Full name</Label>
              <Input
                id="signup-name"
                value={form.fullName}
                onChange={(e) => update("fullName", e.target.value)}
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
                required
                minLength={8}
              />
              <p className="text-xs text-muted-foreground">At least 8 characters</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="signup-phone">Phone</Label>
                <Input
                  id="signup-phone"
                  type="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-dob">Date of birth</Label>
                <Input
                  id="signup-dob"
                  type="date"
                  value={form.dob}
                  onChange={(e) => update("dob", e.target.value)}
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Creating account…" : "Create account"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link href="/auth" className="hover:text-black">
              Log in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
