"use client";

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
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 py-12">
      <div className="w-full max-w-md rounded-lg border bg-white p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-4xl font-bold">Reset Password</h1>
          <p className="mt-3 text-gray-500">Enter your new password below.</p>
        </div>
        {pageState === "loading" ? (
          <p className="mt-4 text-sm text-muted-foreground">Verifying reset link...</p>
        ) : pageState === "invalid" ? (
          <div className="mt-4 text-center">
            <p className="text-sm text-muted-foreground">
              This reset link has expired or was already used. Request a new one.
            </p>
            <Link
              href="/forgot-password"
              className="mt-4 inline-block text-sm text-[#4F1DDB] underline"
            >
              Request a new reset link
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="np">New password</Label>
              <Input
                id="np"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="np2">Confirm password</Label>
              <Input
                id="np2"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Updating..." : "Continue"}
            </Button>
          </form>
        )}
      </div>
      <footer className="mt-8 text-center text-xs text-gray-400">
        <p>© 2026 BodyInc</p>
      </footer>
    </div>
  );
}
