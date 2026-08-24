"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { InputOTP, InputOTPSlot } from "@/components/ui/input-otp";
import { OTP_LENGTH, wrongPortalMessage } from "@/lib/auth/constants";
import {
  changeCheckoutEmail,
  checkPatientEmail,
  reconcileCheckoutEmail,
  sendPatientLoginOtp,
} from "@/lib/actions/patient-auth";
import { healProfileEmail } from "@/lib/actions/profile";
import { createClient } from "@/lib/supabase/client";

type Phase = "loading" | "sendCurrent" | "verifyCurrent" | "enterNew" | "verifyNew";

const emailSchema = z.string().trim().email("Enter a valid email").max(255);

// Supabase throttles auth emails (a short per-address cooldown plus an hourly cap on the
// built-in mailer). Surface that as a clear message instead of a raw error.
function describeSendError(message: string): string {
  const m = message.toLowerCase();
  if (
    m.includes("rate limit") ||
    m.includes("too many") ||
    m.includes("after") ||
    m.includes("seconds")
  ) {
    return "Too many code requests. Please wait about a minute, then try again.";
  }
  return message || "Could not send the code. Please try again.";
}

async function verifyEmailOtp(
  supabase: ReturnType<typeof createClient>,
  email: string,
  token: string,
) {
  const first = await supabase.auth.verifyOtp({ email, token, type: "magiclink" });
  if (!first.error) return first;
  return supabase.auth.verifyOtp({ email, token, type: "email" });
}

function OtpBoxes({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="mx-auto mt-8 flex max-w-full justify-center overflow-visible sm:mt-10">
      <InputOTP
        maxLength={OTP_LENGTH}
        value={value}
        onChange={onChange}
        inputMode="numeric"
        autoFocus
        containerClassName="justify-center gap-0.5 sm:gap-2"
      >
        {Array.from({ length: OTP_LENGTH }, (_, index) => (
          <InputOTPSlot
            key={index}
            index={index}
            className="h-10 w-6.5 rounded-[8px] border border-[#152A51]/40 bg-white text-lg font-semibold text-[#152A51] shadow-none outline-none first:rounded-[8px] first:border-l last:rounded-[8px] after:hidden focus:outline-none focus:ring-0 focus-visible:border-[#152A51] focus-visible:ring-0 focus-visible:ring-offset-0 sm:h-[50px] sm:w-[50px] sm:text-[24px]"
          />
        ))}
      </InputOTP>
    </div>
  );
}

export default function ProfileChangeEmailPage() {
  const router = useRouter();
  const supabase = createClient();

  const [phase, setPhase] = useState<Phase>("loading");
  const [currentEmail, setCurrentEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      // Read the canonical (verified) email and, if a prior change was abandoned, restore the
      // auth login email to it — so this screen never shows an unverified pending address.
      const result = await healProfileEmail();
      if (!result?.email) {
        router.push("/auth");
        return;
      }
      setCurrentEmail(result.email);
      setPhase("sendCurrent");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendCurrentCode() {
    setBusy(true);
    try {
      const sent = await sendPatientLoginOtp(currentEmail);
      if (!sent.ok) {
        toast.error(describeSendError(sent.message));
        return;
      }
      setOtp("");
      setPhase("verifyCurrent");
      toast.success("We sent a code to your current email.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCurrentCode() {
    if (otp.length < OTP_LENGTH) {
      toast.error(`Enter the ${OTP_LENGTH}-digit code`);
      return;
    }
    setBusy(true);
    try {
      const { error } = await verifyEmailOtp(supabase, currentEmail, otp);
      if (error) {
        toast.error(error.message);
        return;
      }
      setOtp("");
      setPhase("enterNew");
    } finally {
      setBusy(false);
    }
  }

  async function submitNewEmail() {
    const parsed = emailSchema.safeParse(newEmail);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Enter a valid email");
      return;
    }
    const normalized = parsed.data.toLowerCase();
    if (normalized === currentEmail.toLowerCase()) {
      toast.error("That's already your email address.");
      return;
    }

    setBusy(true);
    try {
      const check = await checkPatientEmail(normalized);
      if (check.status === "patient") {
        toast.error("That email is already in use by another account.");
        return;
      }
      if (check.status === "wrong_portal") {
        toast.error(wrongPortalMessage(check.role));
        return;
      }
      if (check.status !== "new") {
        toast.error("Could not verify that email. Please try again.");
        return;
      }

      // Re-point the login email to the new address and send it a verification code. The
      // profile/admin/Stripe view is not updated until the new code is verified below.
      const result = await changeCheckoutEmail(normalized);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      const sent = await sendPatientLoginOtp(result.email);
      if (!sent.ok) {
        // The login email was already re-pointed to the new address; if the code couldn't be
        // sent (e.g. rate limit), undo that so the account isn't stranded and a retry doesn't
        // collide with itself as "already in use".
        await healProfileEmail();
        toast.error(describeSendError(sent.message));
        return;
      }
      setNewEmail(result.email);
      setOtp("");
      setPhase("verifyNew");
      toast.success("We sent a code to your new email.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyNewCode() {
    if (otp.length < OTP_LENGTH) {
      toast.error(`Enter the ${OTP_LENGTH}-digit code`);
      return;
    }
    setBusy(true);
    try {
      const { error } = await verifyEmailOtp(supabase, newEmail, otp);
      if (error) {
        toast.error(error.message);
        return;
      }
      await reconcileCheckoutEmail();
      toast.success("Email updated.");
      router.refresh();
      router.push("/profile");
    } finally {
      setBusy(false);
    }
  }

  async function resendNewCode() {
    const sent = await sendPatientLoginOtp(newEmail);
    if (!sent.ok) {
      toast.error(describeSendError(sent.message));
      return;
    }
    toast.success("Code resent");
  }

  const stepLabel = phase === "enterNew" || phase === "verifyNew" ? "Step 2 of 2" : "Step 1 of 2";

  return (
    <AuthPageShell footer={null}>
      <div className="text-center">
        {phase === "loading" ? (
          <p className="text-base text-[#152A51] sm:text-[18px]">Loading…</p>
        ) : phase === "sendCurrent" ? (
          <>
            <p className="mb-2 text-sm font-medium uppercase tracking-wide text-[#152A51]/50">
              {stepLabel}
            </p>
            <AuthHeading
              title="Confirm Your Email"
              description="First, verify your current email address. We'll send a code to:"
            />
            <p className="break-all text-base font-medium text-[#152A51] sm:text-lg lg:text-[22px]">
              {currentEmail}
            </p>
            <Button
              onClick={sendCurrentCode}
              disabled={busy}
              className={`mt-8 ${authButtonClassName}`}
            >
              {busy ? "Sending…" : "Send verification code"}
            </Button>
          </>
        ) : phase === "verifyCurrent" ? (
          <>
            <p className="mb-2 text-sm font-medium uppercase tracking-wide text-[#152A51]/50">
              {stepLabel}
            </p>
            <AuthHeading
              title="Enter Verification Code"
              description={`Enter the ${OTP_LENGTH}-digit code sent to`}
            />
            <p className="break-all text-base font-medium text-[#152A51] sm:text-lg lg:text-[22px]">
              {currentEmail}
            </p>
            <OtpBoxes value={otp} onChange={setOtp} />
            <Button
              onClick={verifyCurrentCode}
              disabled={busy}
              className={`mt-6 ${authButtonClassName}`}
            >
              {busy ? "Verifying…" : "Verify current email"}
            </Button>
            <p className="mt-6 text-base text-[#152A51] sm:text-[18px]">
              Didn&apos;t receive the code?{" "}
              <button
                type="button"
                onClick={sendCurrentCode}
                className="font-semibold underline underline-offset-4"
              >
                Resend code
              </button>
            </p>
          </>
        ) : phase === "enterNew" ? (
          <>
            <p className="mb-2 text-sm font-medium uppercase tracking-wide text-[#152A51]/50">
              {stepLabel}
            </p>
            <AuthHeading
              title="Enter New Email"
              description="We'll send a code to this address to verify it before switching."
            />
            <div className="space-y-2 text-left">
              <Label htmlFor="new-email" className="text-[14px] font-semibold text-[#152A51]">
                New email address
              </Label>
              <Input
                id="new-email"
                type="email"
                autoComplete="email"
                autoFocus
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="name@company.com"
                className={authInputClassName}
              />
            </div>
            <Button
              onClick={submitNewEmail}
              disabled={busy}
              className={`mt-8 ${authButtonClassName}`}
            >
              {busy ? "Sending…" : "Send code to new email"}
            </Button>
          </>
        ) : (
          <>
            <p className="mb-2 text-sm font-medium uppercase tracking-wide text-[#152A51]/50">
              {stepLabel}
            </p>
            <AuthHeading
              title="Verify New Email"
              description={`Enter the ${OTP_LENGTH}-digit code sent to`}
            />
            <p className="break-all text-base font-medium text-[#152A51] sm:text-lg lg:text-[22px]">
              {newEmail}
            </p>
            <OtpBoxes value={otp} onChange={setOtp} />
            <Button
              onClick={verifyNewCode}
              disabled={busy}
              className={`mt-6 ${authButtonClassName}`}
            >
              {busy ? "Verifying…" : "Confirm new email"}
            </Button>
            <p className="mt-6 text-base text-[#152A51] sm:text-[18px]">
              Didn&apos;t receive the code?{" "}
              <button
                type="button"
                onClick={resendNewCode}
                className="font-semibold underline underline-offset-4"
              >
                Resend code
              </button>
            </p>
          </>
        )}

        <p className="mt-8 text-center text-sm text-[#152A51]/80">
          <Link href="/profile" className="font-medium text-[#152A51] hover:underline">
            ← Back to profile
          </Link>
        </p>
      </div>
    </AuthPageShell>
  );
}
