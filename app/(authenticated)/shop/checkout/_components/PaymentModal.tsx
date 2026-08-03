"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { getStripeJs } from "@/lib/stripe/client";
import { cn } from "@/lib/utils";

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

    if (confirmError) {
      setError(confirmError.message ?? "Payment could not be completed.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <PaymentElement />
        {error ? (
          <p className="mt-3 rounded-[12px] border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            {error}
          </p>
        ) : null}
      </div>
      <Button
        type="submit"
        disabled={!stripe || submitting}
        className="h-[46px] w-full shrink-0 rounded-full bg-[#E3E084] text-[#152A51] shadow-none hover:bg-[#D9D674]"
      >
        {submitting ? "Processing…" : "Pay & Start Subscription"}
      </Button>
    </form>
  );
}

type PaymentModalProps = {
  open: boolean;
  clientSecret: string;
  returnUrl: string;
  onOpenChange: (open: boolean) => void;
};

export default function PaymentModal({
  open,
  clientSecret,
  returnUrl,
  onOpenChange,
}: PaymentModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-[#F3F6F6]/70 backdrop-blur-md lg:left-[260px]" />
        <DialogPrimitive.Content
          className={cn(
            "fixed top-[50%] z-50 flex w-[calc(100%-1.5rem)] max-w-lg translate-y-[-50%] flex-col gap-4 rounded-2xl border border-[#E8EEED] bg-white p-5 shadow-lg duration-200 sm:p-6",
            "left-[50%] translate-x-[-50%] lg:left-[calc(50%+130px)]",
            "max-h-[min(85vh,720px)] overflow-hidden",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}
        >
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm text-[#152A51]/60 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[#152A51]/30">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>

          <div className="shrink-0 pr-6">
            <DialogTitle className="text-lg font-semibold text-[#152A51]">
              Payment details
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-[#152A51]/70">
              Enter your card to complete this subscription.
            </DialogDescription>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
