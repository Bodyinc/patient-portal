"use client";

import { useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Lock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getStripeJs } from "@/lib/stripe/client";

function PaymentFields({
  returnUrl,
  consentAccepted,
  onPaid,
}: {
  returnUrl: string;
  consentAccepted: boolean;
  onPaid: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!consentAccepted) {
      toast.error("Please accept the Terms & Conditions and Privacy Policy to continue");
      return;
    }
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
        <p className="rounded-[14px] border border-red-200 bg-red-50 p-2 text-[12px] text-red-700">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={!stripe || submitting || !consentAccepted}
        className="h-[46px] w-full rounded-full bg-[#E3E084] text-[14px] font-medium text-[#152A51] hover:bg-[#D9D674] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Processing…" : "Pay & Start Treatment"}
      </Button>
    </form>
  );
}

export default function OnboardingPaymentForm({
  clientSecret,
  returnUrl,
  consentAccepted,
  onPaid,
}: {
  clientSecret: string;
  returnUrl: string;
  consentAccepted: boolean;
  onPaid: () => void;
}) {
  return (
    <div className="rounded-[14px] border border-[#E8E8E8] bg-white p-4 onboarding-font">
      <div className="mb-3 flex items-center justify-between border-b border-[#E8E8E8] pb-2">
        <h2 className="text-[15px] font-medium text-[#152A51] sm:text-[16px]">Payment Details</h2>
        <Lock size={16} className="text-[#152A51]" />
      </div>
      <Elements stripe={getStripeJs()} options={{ clientSecret, appearance: { theme: "stripe" } }}>
        <PaymentFields returnUrl={returnUrl} consentAccepted={consentAccepted} onPaid={onPaid} />
      </Elements>
      <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-[#152A51]/70">
        <Lock className="h-3 w-3" aria-hidden />
        Secure payment powered by Stripe
      </p>
    </div>
  );
}
