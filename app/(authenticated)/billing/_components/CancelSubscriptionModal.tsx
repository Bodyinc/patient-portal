"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CANCELLATION_REASONS, type CancellationReasonId } from "@/lib/billing/cancel-reasons";
import { cn } from "@/lib/utils";

type CancelSubscriptionModalProps = {
  open: boolean;
  subscriptionId: string;
  medicineName: string;
  onOpenChange: (open: boolean) => void;
};

export default function CancelSubscriptionModal({
  open,
  subscriptionId,
  medicineName,
  onOpenChange,
}: CancelSubscriptionModalProps) {
  const router = useRouter();
  const [isSubmitting, startSubmitting] = useTransition();
  const [selectedReasons, setSelectedReasons] = useState<CancellationReasonId[]>([]);
  const [otherText, setOtherText] = useState("");
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setSelectedReasons([]);
    setOtherText("");
    setError(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (isSubmitting) return;
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  }

  function toggleReason(reasonId: CancellationReasonId) {
    setSelectedReasons((current) =>
      current.includes(reasonId) ? current.filter((id) => id !== reasonId) : [...current, reasonId],
    );
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
            subscriptionId,
            reasons: selectedReasons,
            otherText: selectedReasons.includes("other") ? otherText : null,
          }),
        });

        const data = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(data.error ?? "Unable to cancel subscription.");
        }

        resetForm();
        onOpenChange(false);
        router.push("/billing?cancelled=1");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to cancel subscription.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        {/* Blur only the main content area — sidebar stays clear on desktop */}
        <DialogOverlay className="bg-[#F3F6F6]/70 backdrop-blur-md lg:left-[260px]" />
        <DialogPrimitive.Content
          className={cn(
            "fixed top-[50%] z-50 grid w-[calc(100%-1.5rem)] max-w-xl translate-y-[-50%] gap-0 rounded-2xl border border-[#E8EEED] bg-white p-5 shadow-lg duration-200 sm:p-8",
            "left-[50%] translate-x-[-50%] lg:left-[calc(50%+130px)]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "max-h-[min(90vh,720px)] overflow-y-auto",
          )}
        >
          <DialogPrimitive.Close
            disabled={isSubmitting}
            className="absolute right-4 top-4 rounded-sm text-[#152A51]/60 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[#152A51]/30 disabled:pointer-events-none"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>

          <div className="text-center">
            <DialogTitle className="text-2xl font-semibold text-[#152A51] sm:text-3xl">
              Help Us Improve
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm text-[#152A51]/70 sm:text-base">
              Help us improve by sharing why you&apos;re cancelling.
            </DialogDescription>
            <p className="mt-1 text-xs text-[#152A51]/60">{medicineName}</p>
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
              onClick={() => handleOpenChange(false)}
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
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
