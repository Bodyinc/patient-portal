"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import AuthPageShell, {
  AuthHeading,
  authButtonClassName,
  authInputClassName,
} from "@/components/AuthPageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeCheckoutEmail, sendPatientLoginOtp } from "@/lib/actions/patient-auth";

const emailSchema = z.object({ email: z.string().trim().email("Enter a valid email") });

function ChangeEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = emailSchema.safeParse({ email });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid email");
      return;
    }

    setBusy(true);
    try {
      const result = await changeCheckoutEmail(parsed.data.email);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      const sent = await sendPatientLoginOtp(result.email, { purpose: "change_email" });
      if (!sent.ok) {
        toast.error(sent.message);
        return;
      }

      toast.success("We sent a code to your new email. Verify it to finish the change.");
      const redirectParam = redirectTo ? `&redirect=${encodeURIComponent(redirectTo)}` : "";
      router.push(
        `/verify-otp?email=${encodeURIComponent(result.email)}&sync=email${redirectParam}`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthPageShell footer={null}>
      <AuthHeading
        title="Edit Email Address"
        description="Update your account email. We'll send a code to the new address to verify it — your treatment plan and payment stay linked to your account."
      />

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="change-email" className="text-[14px] font-semibold text-[#152A51]">
            New Email Address
          </Label>
          <Input
            id="change-email"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={authInputClassName}
            required
          />
        </div>

        <Button type="submit" className={authButtonClassName} disabled={busy}>
          {busy ? "Updating..." : "Update Email →"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[#152A51]/80">
        <button
          type="button"
          onClick={() => router.back()}
          className="font-medium text-[#152A51] hover:underline"
        >
          Back
        </button>
      </p>
    </AuthPageShell>
  );
}

export default function ChangeEmailPage() {
  return (
    <Suspense fallback={<div className="flex min-h-dvh items-center justify-center" />}>
      <ChangeEmailContent />
    </Suspense>
  );
}
