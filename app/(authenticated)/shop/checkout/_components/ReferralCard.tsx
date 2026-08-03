"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type ReferralCardProps = {
  referralHint: string;
  promoCode: string;
  onPromoCodeChange: (value: string) => void;
  onApply: () => Promise<{ ok: true; label: string } | { ok: false; message: string }>;
  appliedLabel?: string | null;
};

export default function ReferralCard({
  referralHint,
  promoCode,
  onPromoCodeChange,
  onApply,
  appliedLabel = null,
}: ReferralCardProps) {
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
      const result = await onApply();
      if (!result.ok) {
        setPromoError(result.message);
        return;
      }
      toast.success(`Promo ${result.label} applied`);
    } catch {
      setPromoError("Unable to apply promo code. Please try again.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <section className="rounded-[24px] border border-[#E8EEED] bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-xl font-medium tracking-[-0.3px] text-[#152A51] sm:text-[22px]">
            Share Wellness, Earn Rewards
          </h3>
          <p className="text-sm text-[#152A51]/70">{referralHint}</p>
        </div>
        <div className="w-full max-w-sm space-y-2">
          <div className="flex items-center gap-2">
            <Input
              value={promoCode}
              onChange={(event) => {
                setPromoError(null);
                onPromoCodeChange(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleApply();
                }
              }}
              placeholder="Enter promo code"
              className="h-[45px] rounded-[14px] border-0 bg-[#E8EEED] px-4 text-sm text-[#152A51] shadow-none placeholder:text-[#152A51]/40 focus-visible:ring-0"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleApply()}
              disabled={applying || !promoCode.trim()}
              className="h-[45px] rounded-full border-[#152A51]/30 bg-white px-5 text-[#152A51] shadow-none hover:bg-[#F3F6F6] disabled:opacity-50"
            >
              {applying ? "Applying…" : "Apply Code"}
            </Button>
          </div>
          {promoError ? <p className="text-xs text-red-600">{promoError}</p> : null}
          {!promoError && appliedLabel ? (
            <p className="text-xs text-[#34845F]">Promo {appliedLabel} applied</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
