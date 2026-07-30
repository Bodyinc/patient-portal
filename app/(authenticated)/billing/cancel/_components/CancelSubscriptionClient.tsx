"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { BillingCancelSubscriptionDto } from "@/lib/billing/types";
import { CANCELLATION_REASONS, type CancellationReasonId } from "@/lib/billing/cancel-reasons";

type CancelSubscriptionClientProps = {
  subscription: BillingCancelSubscriptionDto;
};

export default function CancelSubscriptionClient({ subscription }: CancelSubscriptionClientProps) {
  const router = useRouter();
  const [isSubmitting, startSubmitting] = useTransition();
  const [selectedReasons, setSelectedReasons] = useState<CancellationReasonId[]>([]);
  const [otherText, setOtherText] = useState("");
  const [error, setError] = useState<string | null>(null);

  function toggleReason(reasonId: CancellationReasonId) {
    setSelectedReasons((current) =>
      current.includes(reasonId) ? current.filter((id) => id !== reasonId) : [...current, reasonId],
    );
  }

  function handleKeepSubscription() {
    router.push("/billing");
  }

  function handleContinueCancellation() {
    if (selectedReasons.length === 0) {
      setError("Please select at least one reason before continuing.");
      return;
    }

    startSubmitting(async () => {
      setError(null);
      try {
        const response = await fetch("/api/billing/subscriptions/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subscriptionId: subscription.id,
            reasons: selectedReasons,
            otherText: selectedReasons.includes("other") ? otherText : null,
          }),
        });

        const data = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(data.error ?? "Unable to cancel subscription.");
        }

        router.push("/billing?cancelled=1");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to cancel subscription.");
      }
    });
  }

  return (
    <div className="relative flex min-h-[calc(100vh-8rem)] items-center justify-center px-2 py-6 sm:px-4">
      <div
        className="pointer-events-none absolute inset-0 bg-[#F3F6F6]/80 backdrop-blur-[2px]"
        aria-hidden
      />

      <section className="relative z-10 w-full max-w-xl rounded-2xl border border-[#E8EEED] bg-white p-5 shadow-sm sm:p-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-[#152A51] sm:text-3xl">Help Us Improve</h1>
          <p className="mt-2 text-sm text-[#152A51]/70 sm:text-base">
            Help us improve by sharing why you&apos;re cancelling.
          </p>
          <p className="mt-1 text-xs text-[#152A51]/60">{subscription.medicineName}</p>
        </div>

        <div className="mt-6 space-y-3">
          {CANCELLATION_REASONS.map((reason) => {
            const checked = selectedReasons.includes(reason.id);
            return (
              <label
                key={reason.id}
                className={`flex cursor-pointer items-center gap-3 rounded-md border px-4 py-3 transition-colors ${
                  checked
                    ? "border-[#152A51]/30 bg-[#F3F6F6]"
                    : "border-[#E8EEED] bg-white hover:bg-[#F3F6F6]"
                }`}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggleReason(reason.id)}
                  className="border-[#152A51]/40 data-[state=checked]:bg-[#152A51] data-[state=checked]:text-white"
                />
                <span className="text-sm text-[#152A51]">{reason.label}</span>
              </label>
            );
          })}
        </div>

        {selectedReasons.includes("other") ? (
          <div className="mt-4">
            <Input
              value={otherText}
              onChange={(event) => setOtherText(event.target.value)}
              placeholder="Tell us more (optional)"
              className="border-[#E8EEED] bg-[#F3F6F6] text-[#152A51] placeholder:text-[#152A51]/50"
            />
          </div>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleKeepSubscription}
            disabled={isSubmitting}
            className="h-11 border-[#152A51]/30 text-[#152A51] hover:bg-[#F3F6F6]"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Keep Subscription
          </Button>
          <Button
            type="button"
            onClick={handleContinueCancellation}
            disabled={isSubmitting}
            className="h-11 bg-[#152A51] text-white hover:bg-[#152A51]/90"
          >
            {isSubmitting ? "Cancelling..." : "Continue Cancellation"}
            {!isSubmitting ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
          </Button>
        </div>
      </section>
    </div>
  );
}
