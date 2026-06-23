"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { enforcePatientPortalAccess } from "@/lib/enforce-patient-access";
import { createClient } from "@/lib/supabase/client";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export default function AuthPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="border-b bg-white px-8 py-4">
        <h1 className="text-lg font-semibold">BodyInc</h1>
      </header>

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
              onClick={() => router.push("/otp-login")}
            >
              Login with OTP
            </Button>
          </div>

          <div className="my-4 flex items-center">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="px-3 text-sm text-gray-400">OR</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <Button type="button" variant="outline" className="w-full" asChild>
            <Link href="/signup">Create Account</Link>
          </Button>
        </div>
      </main>

      <footer className="border-t bg-white py-4 text-center text-sm text-gray-500">
        © 2026 BodyInc
      </footer>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const supabase = createClient();
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

      const allowed = await enforcePatientPortalAccess();
      if (!allowed) return;

      toast.success("Welcome back");
      router.push("/dashboard");
      router.refresh();
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
        <Label htmlFor="login-password">Password</Label>
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
            href="/forgot-password"
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
