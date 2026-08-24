"use client";

import { useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { getStripeJs } from "@/lib/stripe/client";

function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    (cents ?? 0) / 100,
  );
}

function Fields({ amountCents }: { amountCents: number }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/my-meds?paid=1`,
      },
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message ?? "Payment could not be completed.");
      setSubmitting(false);
      return;
    }

    const paidUrl = new URL("/my-meds", window.location.origin);
    paidUrl.searchParams.set("paid", "1");
    if (paymentIntent?.id) paidUrl.searchParams.set("payment_intent", paymentIntent.id);
    window.location.assign(paidUrl.toString());
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={!stripe || submitting}
        className="h-11 w-full rounded-lg bg-[#152A51] text-sm font-semibold text-white hover:bg-[#152A51]/90 disabled:opacity-60"
      >
        {submitting ? "Processing…" : `Pay ${money(amountCents)}`}
      </button>
    </form>
  );
}

export default function AdditionalPaymentForm({
  clientSecret,
  amountCents,
}: {
  clientSecret: string;
  amountCents: number;
}) {
  return (
    <section className="rounded-xl border border-[#152A51]/15 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-[#152A51]">Payment details</h2>
      <Elements stripe={getStripeJs()} options={{ clientSecret, appearance: { theme: "stripe" } }}>
        <Fields amountCents={amountCents} />
      </Elements>
    </section>
  );
}
