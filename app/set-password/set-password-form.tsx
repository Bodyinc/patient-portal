"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import AuthPageShell, {
  AuthHeading,
  authButtonClassName,
  authInputClassName,
} from "@/components/AuthPageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setInitialPassword } from "@/lib/actions/patient-auth";

export function SetPasswordForm({ next }: { next: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

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
      const result = await setInitialPassword(password);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Password set");
      router.refresh();
      router.replace(next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthPageShell footer={null}>
      <div className="text-center">
        <AuthHeading
          title="Secure Your Account"
          description="Set a password so you can sign in without a code next time."
        />

        <form onSubmit={onSubmit} className="space-y-5 text-left">
          <div>
            <Label htmlFor="sp" className="mb-2 block text-[14px] font-semibold text-[#152A51]">
              Password
            </Label>

            <Input
              id="sp"
              type="password"
              autoComplete="new-password"
              autoFocus
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className={authInputClassName}
            />
          </div>

          <div>
            <Label htmlFor="sp2" className="mb-2 block text-[14px] font-semibold text-[#152A51]">
              Confirm Password
            </Label>

            <Input
              id="sp2"
              type="password"
              autoComplete="new-password"
              placeholder="Re-enter your password"
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

          <p className="break-words text-center text-sm leading-snug text-[#152A51] sm:text-base">
            Need help?{" "}
            <button type="button" className="font-semibold underline underline-offset-4">
              Contact support
            </button>
          </p>
        </form>
      </div>
    </AuthPageShell>
  );
}
