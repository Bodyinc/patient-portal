"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hasPassword, setInitialPassword } from "@/lib/actions/patient-auth";
import { fieldControlClass } from "../../_lib/onboarding-theme";

function DashboardActions() {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
      <Button
        type="button"
        onClick={() => router.push("/dashboard")}
        className="h-10 w-full rounded-md bg-[#152A51] px-6 hover:bg-[#10213F] sm:w-auto"
      >
        Go to Dashboard
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>

      <Button
        type="button"
        variant="outline"
        onClick={() => router.push("/my-meds")}
        className="h-10 w-full rounded-md border-[#152A51]/40 px-6 text-[#152A51] sm:w-auto"
      >
        View Treatment Details
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

function SetPasswordForm({ onSuccess }: { onSuccess: () => void }) {
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
      onSuccess();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-[#152A51]/20 bg-white onboarding-font">
      <div className="bg-[#E8EEED] px-5 py-3">
        <h2 className="text-[16px] font-semibold text-[#152A51] sm:text-lg">Secure Your Account</h2>
        <p className="mt-1 text-[12px] text-[#152A51]/70 sm:text-[13px]">
          Create a password once so you can sign in to your dashboard next time.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 p-5">
        <div>
          <Label htmlFor="onb-pw" className="mb-2 block text-[13px] font-medium text-[#152A51]">
            Password
          </Label>
          <Input
            id="onb-pw"
            type="password"
            autoComplete="new-password"
            placeholder="Create a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className={fieldControlClass}
          />
        </div>
        <div>
          <Label htmlFor="onb-pw2" className="mb-2 block text-[13px] font-medium text-[#152A51]">
            Confirm Password
          </Label>
          <Input
            id="onb-pw2"
            type="password"
            autoComplete="new-password"
            placeholder="Re-enter your password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            className={fieldControlClass}
          />
        </div>
        <Button
          type="submit"
          disabled={busy}
          className="h-[46px] w-full rounded-full bg-[#E3E084] text-[14px] font-medium text-[#152A51] hover:bg-[#D9D674]"
        >
          {busy ? "Saving…" : "Save Password"}
        </Button>
      </form>
    </div>
  );
}

/**
 * One-time password setup after checkout. Dashboard actions appear only after success.
 * No update-password form — password can be set exactly once here.
 */
export default function ConfirmationPasswordGate() {
  const [passwordSet, setPasswordSet] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void hasPassword().then((set) => {
      if (active) setPasswordSet(set);
    });
    return () => {
      active = false;
    };
  }, []);

  if (passwordSet === null) {
    return (
      <div className="rounded-2xl border border-[#152A51]/15 bg-white px-5 py-4 text-sm text-[#152A51]/70">
        Preparing your account…
      </div>
    );
  }

  if (passwordSet) {
    return <DashboardActions />;
  }

  return (
    <SetPasswordForm
      onSuccess={() => {
        setPasswordSet(true);
      }}
    />
  );
}
