"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

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
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-white via-purple-50 to-white">
      <Image
       src="/background-curve.svg"
       alt="Background Shape"
       fill
       className="pointer-events-none object-cover opacity-40"
       />

      <div className="absolute left-8 top-8 z-10">
      <Image
       src="/logo.svg"
       alt="BodyInc"
       width={160}
       height={50}
       priority
       />
       </div>
      

      <main className="relative z-10 flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h2 className="text-4xl font-bold text-[#4F1DDB]">Welcome Back</h2>
            <p className="mt-3 text-gray-500">
              Please enter your credentials to access your portal.
            </p>
          </div>

          <LoginForm />

          <div className="mt-4">
            <Button
              type="button"
              variant="outline"
              className="w-full border-[#4F1DDB] text-[#4F1DDB]"
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

      <footer className="py-8 text-center text-sm text-gray-500">
        © 2026 BodyInc
      </footer>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center" />}>
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
    <form onSubmit={onSubmit} className="mt-4 space-y-4 rounded-lg border bg-card p-6 shadow-sm">
      <div className="space-y-2">
        <Label htmlFor="login-email" className="text-[#4F1DDB]">Email</Label>
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
        <Label htmlFor="login-password" className="text-[#4F1DDB]">Password</Label>
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
            className="text-sm text-[#4F1DDB] hover:text-[#4F1DDB]"

          >
            Forgot Password?
          </Link>
        </div>
      </div>
      <Button
        type="submit"
        className="w-full bg-[#4F1DDB] hover:bg-[#4420c9]"
        disabled={busy}
         >
        {busy ? "Signing in…" : "Log in"}
      </Button>
    </form>
  );
}
