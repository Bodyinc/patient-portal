"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import AuthPageShell, {
  AuthHeading,
  authButtonClassName,
  authInputClassName,
  authOutlineButtonClassName,
} from "@/components/AuthPageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { onLoginSuccess } from "@/lib/auth/on-login-success";
import { WRONG_PORTAL_GENERIC_MESSAGE } from "@/lib/auth/constants";
import { createClient } from "@/lib/supabase/client";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const error = searchParams.get("error");
    if (error === "wrong_portal") {
      toast.error(WRONG_PORTAL_GENERIC_MESSAGE, { duration: 8000 });
    } else if (error === "auth_callback") {
      toast.error("Could not complete sign-in. Please try again.");
    }
  }, [searchParams]);

  return (
    <AuthPageShell>
      <AuthHeading
        title="Welcome Back"
        description="Sign to manage your care and track progress."
      />

      <LoginForm />

      <div className="mt-5">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/otp-login")}
          className={authOutlineButtonClassName}
        >
          Login with OTP
        </Button>
      </div>
    </AuthPageShell>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="flex min-h-dvh items-center justify-center" />}>
      <AuthPageContent />
    </Suspense>
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

      await onLoginSuccess(router);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 sm:space-y-7">
      <div className="space-y-2">
        <Label htmlFor="login-email" className="text-[14px] font-semibold leading-5 text-[#2E00AB]">
          Email Address
        </Label>

        <Input
          id="login-email"
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
          htmlFor="login-password"
          className="text-[14px] font-semibold leading-5 text-[#2E00AB]"
        >
          Password
        </Label>

        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className={authInputClassName}
          required
        />

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-[14px] text-[#8B6FD8]">
            <input type="checkbox" className="h-4 w-4 rounded border-[#E5E5E5]" />
            Remember Me
          </label>

          <Link
            href="/forgot-password"
            className="text-[14px] font-medium text-[#2E00AB] hover:underline"
          >
            Forgot Password?
          </Link>
        </div>
      </div>

      <Button type="submit" className={authButtonClassName} disabled={busy}>
        {busy ? "Signing in..." : "Login →"}
      </Button>
    </form>
  );
}
