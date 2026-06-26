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
    <div className="relative min-h-screen overflow-hidden bg-white">
      <Image
        src="/background-curve.svg"
        alt="Background Shape"
        fill
        className="pointer-events-none object-cover opacity-40"
      />

      <div className="absolute left-8 top-8 z-10">
        <Image src="/logo.svg" alt="BodyInc" width={160} height={50} priority />
      </div>

      <main className="relative z-10 flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-[502px]">
          <div className="mb-10 text-center">
            <h2 className="text-[37px] font-bold leading-none tracking-[0] text-[#2E00AB]">
              Welcome Back
            </h2>

            <p className="mt-4 text-center text-[20px] font-normal leading-[20px] text-[#2E00AB]">
              Sign to manage your care and track progress.
            </p>
          </div>

          <LoginForm />

          <div className="mt-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/otp-login")}
              className="h-[52px] w-full rounded-md border border-[#8E71F5] bg-white text-[18px] font-semibold text-[#2E00AB] shadow-none transition-colors hover:bg-[#F8F5FF] hover:text-[#2E00AB] hover:border-[#8E71F5]"
            >
              Login with OTP
            </Button>
          </div>
        </div>
      </main>

      <footer className="pb-8 pt-4 text-center text-[13px] text-[#A6A6A6]">© 2026 BodyInc</footer>
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
    <form onSubmit={onSubmit} className="mt-8 space-y-7">
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
          className="h-[51px] rounded-md border border-[#F2F2F2] bg-white px-4 text-[15px] text-[#2E00AB] placeholder:text-[#7C63D6] shadow-none focus-visible:border-[#2E00AB] focus-visible:ring-1 focus-visible:ring-[#2E00AB]"
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
          className="h-[51px] rounded-md border border-[#F2F2F2] bg-white px-4 text-[15px] text-[#2E00AB] placeholder:text-[#7C63D6] shadow-none focus-visible:border-[#2E00AB] focus-visible:ring-1 focus-visible:ring-[#2E00AB]"
          required
        />

        <div className="mt-3 flex items-center justify-between">
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

      <Button
        type="submit"
        className="h-[52px] w-full rounded-md bg-[#2E00AB] text-[18px] font-semibold text-white shadow-none hover:bg-[#25008D]"
        disabled={busy}
      >
        {busy ? "Signing in..." : "Login →"}
      </Button>
    </form>
  );
}
