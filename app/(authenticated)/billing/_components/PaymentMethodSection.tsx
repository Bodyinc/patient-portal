"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getStripeJs } from "@/lib/stripe/client";

function UpdateCardForm({ onDone }: { onDone: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setError(null);

    const { error: confirmError, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message ?? "Could not save the card.");
      setSubmitting(false);
      return;
    }

    const paymentMethodId =
      typeof setupIntent?.payment_method === "string"
        ? setupIntent.payment_method
        : setupIntent?.payment_method?.id;

    if (!paymentMethodId) {
      setError("Could not read the saved card. Please try again.");
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/billing/payment-method", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethodId }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to update card.");

      toast.success("Your card on file has been updated.");
      onDone();
      router.refresh();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update card.");
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
        className="h-11 w-full bg-[#152A51] text-white hover:bg-[#152A51]/90"
      >
        {submitting ? "Saving…" : "Save card"}
      </Button>
    </form>
  );
}

export default function PaymentMethodSection() {
  const [open, setOpen] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function openDialog() {
    setOpen(true);
    setClientSecret(null);
    setLoading(true);
    try {
      const response = await fetch("/api/billing/payment-method", { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as {
        clientSecret?: string;
        error?: string;
      };
      if (!response.ok || !payload.clientSecret) {
        throw new Error(payload.error ?? "Unable to start card update.");
      }
      setClientSecret(payload.clientSecret);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to start card update.");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-md border border-[#E8EEED] bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E8EEED] text-[#152A51]">
            <CreditCard className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-[#152A51]">Payment Method</h2>
            <p className="text-sm text-[#152A51]/70">
              Update the card used for your subscription renewals.
            </p>
          </div>
        </div>
        <Button
          type="button"
          onClick={openDialog}
          variant="outline"
          className="border-[#152A51] text-[#152A51] hover:bg-[#F3F6F6]"
        >
          Update card
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update card on file</DialogTitle>
            <DialogDescription>
              Your new card will be used for upcoming subscription renewals.
            </DialogDescription>
          </DialogHeader>

          {loading || !clientSecret ? (
            <p className="py-6 text-center text-sm text-[#152A51]/60">Loading secure form…</p>
          ) : (
            <Elements
              stripe={getStripeJs()}
              options={{ clientSecret, appearance: { theme: "stripe" } }}
            >
              <UpdateCardForm onDone={() => setOpen(false)} />
            </Elements>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
