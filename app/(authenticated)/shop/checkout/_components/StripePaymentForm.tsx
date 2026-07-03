"use client";

import { useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";

import { Button } from "@/components/ui/button";
import { getStripeJs } from "@/lib/stripe/client";

function PaymentFields({ returnUrl }: { returnUrl: string }) {
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
    });

    // Reached only when confirmation fails without a redirect.
    if (confirmError) {
      setError(confirmError.message ?? "Payment could not be completed.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
        {submitting ? "Processing…" : "Pay & Start Subscription"}
      </Button>
    </form>
  );
}

export default function StripePaymentForm({
  clientSecret,
  returnUrl,
}: {
  clientSecret: string;
  returnUrl: string;
}) {
  return (
    <section className="rounded-xl border border-[#2E00AB]/15 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-[#2E00AB]">Payment details</h2>
      <Elements stripe={getStripeJs()} options={{ clientSecret, appearance: { theme: "stripe" } }}>
        <PaymentFields returnUrl={returnUrl} />
      </Elements>
    </section>
  );
}
