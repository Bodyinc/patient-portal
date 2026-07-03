"use client";

import { useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getStripeJs } from "@/lib/stripe/client";

function PaymentFields({ returnUrl, onPaid }: { returnUrl: string; onPaid: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setError(null);

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message ?? "Payment could not be completed.");
      setSubmitting(false);
      return;
    }

    // No redirect was required (card needed no 3-D Secure) — finish in place.
    onPaid();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <PaymentElement />
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={!stripe || submitting}
        className="h-11 w-full bg-[#2E00AB] text-white hover:bg-[#2E00AB]/90"
      >
        {submitting ? "Processing…" : "Pay & Start Treatment"}
      </Button>
    </form>
  );
}

export default function OnboardingPaymentForm({
  clientSecret,
  returnUrl,
  onPaid,
}: {
  clientSecret: string;
  returnUrl: string;
  onPaid: () => void;
}) {
  return (
    <div className="rounded-[12px] border border-[#2E00AB]/20 bg-white p-3">
      <div className="mb-2 flex items-center justify-between border-b border-[#2E00AB]/10 pb-1.5">
        <h2 className="text-sm font-semibold text-[#2E00AB] sm:text-base">Payment Details</h2>
        <Lock size={16} className="text-[#2E00AB]" />
      </div>
      <Elements stripe={getStripeJs()} options={{ clientSecret, appearance: { theme: "stripe" } }}>
        <PaymentFields returnUrl={returnUrl} onPaid={onPaid} />
      </Elements>
    </div>
  );
}
