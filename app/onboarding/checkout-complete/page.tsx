"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  claimCheckoutForCurrentUser,
  preparePostCheckoutAccount,
} from "@/lib/actions/patient-auth";
import { createClient } from "@/lib/supabase/client";
import { useOnboarding } from "../_lib/onboarding-store";

const ORDER_CONFIRMATION_REDIRECT = "/order-confirmation";

function StatusScreen({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF8FF] p-6">
      <p className="text-sm text-[#2E00AB]">{message}</p>
    </div>
  );
}

function CheckoutCompleteInner() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();
  const { updateState } = useOnboarding();
  const ran = useRef(false);
  const [message, setMessage] = useState("Finalizing your order…");

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const redirectStatus = params.get("redirect_status");

    void (async () => {
      if (redirectStatus && redirectStatus !== "succeeded") {
        setMessage("Payment was not completed. Redirecting you back to checkout…");
        setTimeout(() => router.push("/onboarding/billing-checkout"), 2500);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await claimCheckoutForCurrentUser();
        updateState({ checkoutConfirmed: true });
        router.push(ORDER_CONFIRMATION_REDIRECT);
        return;
      }

      const accountResult = await preparePostCheckoutAccount();
      if (!accountResult.ok) {
        setMessage(accountResult.message);
        return;
      }

      const { error: otpError } = await supabase.auth.signInWithOtp({ email: accountResult.email });
      if (otpError) {
        setMessage(otpError.message);
        return;
      }

      updateState({ checkoutConfirmed: true });
      router.push(
        `/verify-otp?email=${encodeURIComponent(accountResult.email)}&redirect=${encodeURIComponent(
          ORDER_CONFIRMATION_REDIRECT,
        )}`,
      );
    })();
  }, [params, router, supabase, updateState]);

  return <StatusScreen message={message} />;
}

export default function CheckoutCompletePage() {
  return (
    <Suspense fallback={<StatusScreen message="Finalizing your order…" />}>
      <CheckoutCompleteInner />
    </Suspense>
  );
}
