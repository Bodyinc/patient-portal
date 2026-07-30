"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { claimCheckoutForCurrentUser } from "@/lib/actions/patient-auth";
import { createClient } from "@/lib/supabase/client";
import { finishGuestCheckoutSession } from "../_lib/finish-guest-checkout";
import { useOnboarding } from "../_lib/onboarding-store";

const ORDER_CONFIRMATION_REDIRECT = "/onboarding/order-confirmation";

function StatusScreen({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F3F6F6] p-6">
      <p className="text-sm text-[#152A51]">{message}</p>
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
        updateState({ questionnaireComplete: true, checkoutConfirmed: true });
        router.push(ORDER_CONFIRMATION_REDIRECT);
        return;
      }

      const sessionResult = await finishGuestCheckoutSession();
      if (!sessionResult.ok) {
        setMessage(sessionResult.message);
        return;
      }

      updateState({ questionnaireComplete: true, checkoutConfirmed: true });
      router.push(ORDER_CONFIRMATION_REDIRECT);
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
