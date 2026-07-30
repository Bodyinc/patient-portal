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
        <p className="rounded-[12px] border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={!stripe || submitting}
        className="h-[46px] w-full rounded-full bg-[#E3E084] text-[#152A51] shadow-none hover:bg-[#D9D674]"
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
    <section className="rounded-[24px] border border-[#E8EEED] bg-white p-4 sm:p-5">
      <h2 className="mb-3 text-[15px] font-medium text-[#152A51]">Payment details</h2>
      <Elements
        stripe={getStripeJs()}
        options={{
          clientSecret,
          appearance: {
            theme: "stripe",
            variables: {
              colorPrimary: "#6A9B9C",
              colorText: "#152A51",
              colorBackground: "#FFFFFF",
              borderRadius: "14px",
              fontFamily: "inherit",
            },
          },
        }}
      >
        <PaymentFields returnUrl={returnUrl} />
      </Elements>
    </section>
  );
}
