"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import AuthPageShell, {
  AuthHeading,
  authButtonClassName,
  authInputClassName,
} from "@/components/AuthPageShell";
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
    <AuthPageShell footer={null}>
      <div className="text-center">
        {pageState === "loading" ? (
          <p className="text-base text-[#2E00AB] sm:text-[18px]">Verifying reset link...</p>
        ) : pageState === "invalid" ? (
          <>
            <AuthHeading
              title="Reset Password"
              description="This reset link has expired or was already used."
            />

            <Link
              href="/forgot-password"
              className="inline-block text-base text-[#2E00AB] underline underline-offset-4 sm:text-[18px]"
            >
              Request a new reset link
            </Link>
          </>
        ) : (
          <>
            <AuthHeading
              title="Create New Password"
              description="Set a new password to secure your account and regain access to your Body Inc. portal."
            />

            <form onSubmit={onSubmit} className="space-y-5 text-left">
              <div>
                <Label htmlFor="np" className="mb-2 block text-[14px] font-semibold text-[#2E00AB]">
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
                  className={authInputClassName}
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
                  className={authInputClassName}
                />
              </div>

              <Button type="submit" disabled={busy} className={authButtonClassName}>
                {busy ? "Saving..." : "Save & Continue →"}
              </Button>

              <p className="break-words text-center text-sm leading-snug text-[#2E00AB] sm:text-base">
                Can&apos;t access your email?{" "}
                <button type="button" className="font-semibold underline underline-offset-4">
                  Contact support
                </button>{" "}
                for assistance.
              </p>

              <div className="text-center">
                <Link
                  href="/auth"
                  className="text-base text-[#2E00AB] underline underline-offset-4 sm:text-[18px]"
                >
                  ← Back to login options
                </Link>
              </div>
            </form>
          </>
        )}
      </div>
    </AuthPageShell>
  );
}
