"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { onLoginSuccess } from "@/lib/auth/on-login-success";
import { createClient } from "@/lib/supabase/client";

type PageState = "loading" | "ready" | "invalid";

type ResetPasswordFormProps = {
  recovery?: string;
  error?: string;
};

export function ResetPasswordForm({ recovery, error }: ResetPasswordFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const [pageState, setPageState] = useState<PageState>(
    error === "link_expired" ? "invalid" : "loading",
  );
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (error === "link_expired") {
      return;
    }

    const recoveryParam = recovery === "1";
    const hash = window.location.hash;
    const hashRecovery = hash.includes("type=recovery") || hash.includes("access_token");

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setPageState("ready");
      }
    });

    async function resolveState() {
      const { data } = await supabase.auth.getSession();
      const hasSession = Boolean(data.session);

      if (hashRecovery) {
        setPageState("ready");
        return;
      }

      if (recoveryParam && hasSession) {
        setPageState("ready");
        return;
      }

      if (recoveryParam && !hasSession) {
        setPageState("invalid");
        return;
      }

      if (hasSession) {
        setPageState("invalid");
        return;
      }

      setPageState("invalid");
    }

    void resolveState();

    return () => subscription.unsubscribe();
  }, [error, recovery, supabase.auth]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        toast.error(updateError.message);
        return;
      }
      await onLoginSuccess(router, "Password updated successfully");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-white via-purple-50 to-white">
      <Image
        src="/background-curve.svg"
        alt=""
        fill
        className="pointer-events-none object-cover opacity-40"
      />

      {/* Logo */}
      <div className="absolute left-8 top-8 z-10">
        <Image src="/logo.svg" alt="BodyInc" width={160} height={50} priority />
      </div>

      <main className="relative z-10 flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-[522px] text-center">
          {pageState === "loading" ? (
            <p className="text-[18px] text-[#2E00AB]">Verifying reset link...</p>
          ) : pageState === "invalid" ? (
            <>
              <h1 className="text-[37px] font-bold text-[#2E00AB]">Reset Password</h1>

              <p className="mt-6 text-[20px] text-[#2E00AB]">
                This reset link has expired or was already used.
              </p>

              <Link
                href="/forgot-password"
                className="mt-8 inline-block text-[18px] text-[#2E00AB] underline underline-offset-4"
              >
                Request a new reset link
              </Link>
            </>
          ) : (
            <>
              {/* Heading */}
              <h1 className="text-[37px] font-bold leading-none text-[#2E00AB]">
                Create New Password
              </h1>

              {/* Description */}
              <p className="mx-auto mt-6 max-w-[522px] text-[20px] leading-none text-[#2E00AB]">
                Set a new password to secure your account and regain access to your Body Inc.
                portal.
              </p>

              {/* Form */}
              <form
                onSubmit={onSubmit}
                className="mx-auto mt-10 w-full max-w-[502px] space-y-5 text-left"
              >
                <div>
                  <Label
                    htmlFor="np"
                    className="mb-2 block text-[14px] font-semibold text-[#2E00AB]"
                  >
                    New Password
                  </Label>

                  <Input
                    id="np"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Enter your new password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="h-[51px] rounded-[6px] border-[#F2F2F2] bg-white px-4"
                  />
                </div>

                <div>
                  <Label
                    htmlFor="np2"
                    className="mb-2 block text-[14px] font-semibold text-[#2E00AB]"
                  >
                    Confirm Password
                  </Label>

                  <Input
                    id="np2"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Re-enter your new password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={8}
                    className="h-[51px] rounded-[6px] border-[#F2F2F2] bg-white px-4"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={busy}
                  className="h-[56px] w-full rounded-[8px] bg-[#2E00AB] text-[18px] font-semibold hover:bg-[#25008D]"
                >
                  {busy ? "Saving..." : "Save & Continue →"}
                </Button>

                <p className="text-center text-[16px] text-[#2E00AB]">
                  Can't access your email?{" "}
                  <button type="button" className="font-semibold underline underline-offset-4">
                    Contact support
                  </button>{" "}
                  for assistance.
                </p>

                <div className="text-center">
                  <Link
                    href="/auth"
                    className="text-[18px] text-[#2E00AB] underline underline-offset-4"
                  >
                    ← Back to login options
                  </Link>
                </div>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
