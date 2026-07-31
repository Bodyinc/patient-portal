"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";

import AuthPageShell, { AuthHeading, authButtonClassName } from "@/components/AuthPageShell";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPSlot } from "@/components/ui/input-otp";
import { OTP_LENGTH } from "@/lib/auth/constants";
import { onLoginSuccess } from "@/lib/auth/on-login-success";
import { hasPassword, reconcileCheckoutEmail } from "@/lib/actions/patient-auth";
import { createClient } from "@/lib/supabase/client";

function VerifyOTPContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const redirectTo = searchParams.get("redirect");
  const supabase = createClient();
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);

  // Checkout/account flows carry a redirect or sync=email and genuinely change the account's
  // email via /change-email. Plain OTP login carries neither — there a typo just means "send the
  // code to a different address", so editing re-enters /otp-login instead of changing any account.
  const isAccountEmailContext = searchParams.get("sync") === "email" || Boolean(redirectTo);
  const editEmailHref = isAccountEmailContext
    ? `/change-email${redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`
    : `/otp-login?email=${encodeURIComponent(email)}`;

  async function verify() {
    if (otp.length < OTP_LENGTH) {
      toast.error(`Enter the ${OTP_LENGTH}-digit code`);
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: "email",
      });
      if (error) {
        toast.error(error.message);
        return;
      }

      if (searchParams.get("sync") === "email") {
        await reconcileCheckoutEmail();
      }

      const destination = redirectTo?.startsWith("/") ? redirectTo : null;

      // Accounts created during checkout have no password — they can only ever get back in via
      // OTP until they set one, so route them through /set-password before their destination.
      if (!(await hasPassword())) {
        router.refresh();
        router.replace(`/set-password?next=${encodeURIComponent(destination ?? "/dashboard")}`);
        return;
      }

      if (destination) {
        toast.success("You're signed in. Continuing your order…");
        router.refresh();
        router.push(destination);
        return;
      }

      await onLoginSuccess(router);
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    // By the time we're on this screen the account exists, so never create one on resend.
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Code resent");
  }

  return (
    <AuthPageShell footer={null}>
      <div className="text-center">
        {/* GLOBAL CSS INJECTION: This directly finds shadcn's caret-blink element and destroys it */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
          .animate-caret-blink, 
          [class*="animate-caret-blink"],
          div[className*="animate-caret-blink"] {
            display: none !important;
            opacity: 0 !important;
            visibility: hidden !important;
            background-color: transparent !important;
          }
        `,
          }}
        />

        <AuthHeading
          title="Enter Verification Code"
          description={`Enter the ${OTP_LENGTH}-digit code sent to`}
        />

        <p className="break-all text-base font-medium text-[#152A51] sm:text-lg lg:text-[22px]">
          {email}
        </p>

        <Link
          href={editEmailHref}
          className="mt-4 inline-block text-base text-[#152A51] underline underline-offset-4 sm:text-[18px]"
        >
          {isAccountEmailContext ? "Change email" : "Use a different email"}
        </Link>

        {/* Changed overflow-x-auto to overflow-visible to prevent any sneaky hidden scrollbar artifacts */}
        <div className="mx-auto mt-8 flex max-w-full justify-center overflow-visible sm:mt-10">
          <InputOTP
            maxLength={OTP_LENGTH}
            value={otp}
            onChange={setOtp}
            inputMode="numeric"
            autoFocus
            containerClassName="justify-center gap-0.5 sm:gap-2"
          >
            {Array.from({ length: OTP_LENGTH }, (_, index) => (
              <InputOTPSlot
                key={index}
                index={index}
                className="h-10 w-6.5 rounded-[8px] border border-[#152A51]/40 bg-white text-lg font-semibold text-[#152A51] shadow-none outline-none first:rounded-[8px] first:border-l last:rounded-[8px] focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[#152A51] after:hidden sm:h-[50px] sm:w-[50px] sm:text-[24px]"
              />
            ))}
          </InputOTP>
        </div>

        <Button onClick={verify} disabled={busy} className={`mt-6 ${authButtonClassName}`}>
          {busy ? "Verifying..." : "Verify"}
        </Button>

        <p className="mt-6 text-base text-[#152A51] sm:text-[18px]">
          Didn&apos;t receive the code?{" "}
          <button
            type="button"
            onClick={resend}
            className="font-semibold underline underline-offset-4"
          >
            Resend code
          </button>
        </p>
      </div>
    </AuthPageShell>
  );
}

export default function VerifyOTPPage() {
  return (
    <Suspense fallback={<div className="flex min-h-dvh items-center justify-center" />}>
      <VerifyOTPContent />
    </Suspense>
  );
}
