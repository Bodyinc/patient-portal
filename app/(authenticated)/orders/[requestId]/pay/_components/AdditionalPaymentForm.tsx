"use client";

import { useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";

import { applyAdditionalPaymentPromo } from "@/lib/actions/additional-payment";
import { getStripeJs, paymentErrorMessage } from "@/lib/stripe/client";

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
      confirmParams: { return_url: `${window.location.origin}/my-meds?paid=1` },
      redirect: "if_required",
    });

    if (confirmError) {
      setError(paymentErrorMessage(confirmError, "Payment could not be completed."));
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
  requestId,
  clientSecret,
  amountCents: initialAmountCents,
  originalAmountCents: initialOriginalCents,
  discountCents: initialDiscountCents,
  promoLabel: initialPromoLabel,
}: {
  requestId: string;
  clientSecret: string;
  amountCents: number;
  originalAmountCents: number;
  discountCents: number;
  promoLabel: string | null;
}) {
  const [promoCode, setPromoCode] = useState(initialPromoLabel ?? "");
  const [appliedLabel, setAppliedLabel] = useState(initialPromoLabel);
  const [amountCents, setAmountCents] = useState(initialAmountCents);
  const [originalAmountCents, setOriginalAmountCents] = useState(initialOriginalCents);
  const [discountCents, setDiscountCents] = useState(initialDiscountCents);
  const [secret, setSecret] = useState(clientSecret);
  const [elementKey, setElementKey] = useState(0);
  const [applying, setApplying] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  async function handleApply() {
    setPromoError(null);
    if (!promoCode.trim()) {
      setPromoError("Enter a promo code");
      return;
    }
    setApplying(true);
    try {
      const result = await applyAdditionalPaymentPromo(requestId, promoCode);
      if (!result.ok) {
        setPromoError(result.message);
        return;
      }
      setPromoCode(result.label);
      setAppliedLabel(result.label);
      setAmountCents(result.amountCents);
      setOriginalAmountCents(result.originalAmountCents);
      setDiscountCents(result.discountCents);
      if (result.completed) {
        window.location.assign(`${window.location.origin}/my-meds?paid=1`);
        return;
      }
      if (result.clientSecret) setSecret(result.clientSecret);
      setElementKey((key) => key + 1);
    } catch {
      setPromoError("Unable to apply promo code. Please try again.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        {discountCents > 0 ? (
          <p className="text-sm text-[#152A51]/50 line-through">{money(originalAmountCents)}</p>
        ) : null}
        <p className="text-2xl font-bold text-[#152A51]">{money(amountCents)}</p>
        {appliedLabel && discountCents > 0 ? (
          <p className="text-sm font-medium text-[#34845F]">
            Promo {appliedLabel} applied (−{money(discountCents)})
          </p>
        ) : null}
        <p className="mt-1 text-xs text-[#152A51]/60">
          Once this is paid, your prescription will be generated and sent for fulfillment.
        </p>
      </div>

      <section className="rounded-xl border border-[#152A51]/15 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-[#152A51]">Payment details</h2>
        <div className="mb-4 space-y-2">
          <div className="flex items-center gap-2">
            <input
              value={promoCode}
              onChange={(event) => {
                setPromoError(null);
                setPromoCode(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleApply();
                }
              }}
              placeholder="Promo code"
              aria-label="Promo code"
              className="h-11 min-w-0 flex-1 rounded-lg border border-[#E8EEED] bg-[#F3F6F6] px-3 text-sm text-[#152A51] outline-none placeholder:text-[#152A51]/40"
            />
            <button
              type="button"
              onClick={() => void handleApply()}
              disabled={applying || !promoCode.trim()}
              className="h-11 shrink-0 rounded-full border border-[#152A51]/30 px-4 text-sm font-medium text-[#152A51] hover:bg-[#F3F6F6] disabled:opacity-50"
            >
              {applying ? "Applying…" : "Apply"}
            </button>
          </div>
          {promoError ? <p className="text-xs text-red-600">{promoError}</p> : null}
        </div>

        <Elements
          key={`${secret}:${elementKey}`}
          stripe={getStripeJs()}
          options={{ clientSecret: secret, appearance: { theme: "stripe" } }}
        >
          <Fields amountCents={amountCents} />
        </Elements>
      </section>
    </div>
  );
}
