import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { supabase } from "@/integrations/supabase/client";
import { ensurePatientRole, getMyRole, signUpPatient } from "@/lib/patient-auth.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · BodyInc Patient Portal" },
      { name: "description", content: "Log in or create your BodyInc patient account." },
    ],
  }),
  component: AuthPage,
});

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

const signupSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "At least 8 characters").max(72),
  fullName: z.string().trim().min(1, "Required").max(120),
  phone: z.string().trim().max(32).optional(),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter your date of birth"),
});

function AuthPage() {
  const navigate = useNavigate();
  
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <header className="border-b bg-white px-8 py-4">
        <h1 className="text-lg font-semibold">BodyInc</h1>
      </header>

      {/* Main */}
      <main className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-md rounded-lg border bg-white p-8 shadow-sm">
          <div className="mb-8 text-center">
            <h2 className="text-4xl font-bold">Welcome Back</h2>
            <p className="mt-3 text-gray-500">
              Please enter your credentials to access your portal.
            </p>
          </div>

          <LoginForm />

          <div className="mt-4">
            <Button
             type="button"
             variant="outline"
             className="w-full"
             onClick={() => navigate({ to: "/otp-login" })}
              >
             Login with OTP
            </Button>
          </div>
          

          <div className="my-4 flex items-center">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="px-3 text-sm text-gray-400">OR</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
          >
            Create Account
          </Button>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white py-4 text-center text-sm text-gray-500">
        © 2026 BodyInc
      </footer>
    </div>
  );
}

function LoginForm() {
  const navigate = useNavigate();
  const router = useRouter();
  const getMyRoleFn = useServerFn(getMyRole);
  const ensureRoleFn = useServerFn(ensurePatientRole);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      // Role enforcement
      let role: string | null = null;
      try {
        const r = await getMyRoleFn();
        role = r.role;
      } catch {
        role = null;
      }
      if (role && role !== "patient") {
        await supabase.auth.signOut();
        toast.error(
          `This email is registered on the ${role} portal. Please sign in at ${role}.bodyinc.com — you cannot use the patient portal.`,
          { duration: 8000 },
        );
        return;
      }
      if (!role) {
        // Self-heal: assign patient role if missing
        await ensureRoleFn();
      }
      toast.success("Welcome back");
      await router.invalidate();
      navigate({ to: "/dashboard" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-4 rounded-lg border bg-card p-6 shadow-sm">
      <div className="space-y-2">
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="login-password">Password</Label>
          
        </div>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <div className="flex justify-end pt-2">
         <Link
            to="/forgot-password"
            className="text-sm text-muted-foreground hover:text-foreground"
            >
            Forgot Password?
         </Link>
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Signing in…" : "Log in"}
      </Button>
    </form>
  );
}

function SignupForm() {
  const navigate = useNavigate();
  const router = useRouter();
  const signUpFn = useServerFn(signUpPatient);
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
    // DOB must be in the past
    if (new Date(parsed.data.dob) >= new Date()) {
      toast.error("Date of birth must be in the past");
      return;
    }
    setBusy(true);
    try {
      const result = await signUpFn({ data: parsed.data });
      if (!result.ok) {
        toast.error(result.message, { duration: 8000 });
        return;
      }
      // Auto sign-in
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (signInErr) {
        toast.success("Account created. Please log in.");
        return;
      }
      toast.success("Account created");
      await router.invalidate();
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sign up");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-4 rounded-lg border bg-card p-6 shadow-sm">
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
  );
}
