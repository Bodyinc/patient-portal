"use client";

import { useEffect, useState } from "react";

import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import { useIntakeSummary } from "../../_hooks/use-intake-catalog";
import { calculateCheckoutPricing } from "../../_lib/intake-pricing";
import { getPublicFees } from "@/lib/actions/fees";

export default function OrderSummary() {
  const { data: summary } = useIntakeSummary();
  const [renewalShippingCents, setRenewalShippingCents] = useState(0);

  useEffect(() => {
    let active = true;
    void getPublicFees().then((f) => {
      if (active) setRenewalShippingCents(f.shippingFeeCents);
    });
    return () => {
      active = false;
    };
  }, []);

  const medicationName = summary?.medicineName ?? "Selected Medication";
  const variantName = summary?.variantName ?? null;
  const planLabel = summary?.packageName ?? "Treatment Plan";
  const loaded = summary?.packagePrice != null;
  const pricing = calculateCheckoutPricing(summary?.packagePrice);

  return (
    <Card className="h-fit w-full overflow-hidden rounded-2xl border border-[#152A51]/25 shadow-none">
      <div className="bg-[#E8EEED] px-5 py-3">
        <h2 className="text-lg font-semibold text-[#152A51]">Order Summary</h2>
      </div>

      <div className="space-y-4 p-5">
        <div className="flex justify-between text-sm">
          <span className="text-[#152A51]/80">Selected Medication</span>
          <span className="text-base text-[#152A51]">{medicationName}</span>
        </div>

        {variantName ? (
          <>
            <Separator />
            <div className="flex justify-between text-sm">
              <span className="text-[#152A51]/80">Variant</span>
              <span className="text-base text-[#152A51]">{variantName}</span>
            </div>
          </>
        ) : null}

        <Separator />

        <div className="flex justify-between text-sm">
          <span className="text-[#152A51]/80">Selected Plan</span>
          <span className="text-base text-[#152A51]">{planLabel}</span>
        </div>

        <Separator />

        <div className="flex justify-between text-sm">
          <span className="text-[#152A51]/80">Consultation fee</span>
          <span className="font-semibold text-emerald-700">FREE</span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-[#152A51]/80">Shipping</span>
          <span className="font-semibold text-emerald-700">FREE</span>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <span className="text-base font-medium text-[#152A51]">Total Paid</span>
          <span className="text-3xl font-semibold text-[#152A51]">
            {loaded ? `$${pricing.total.toFixed(2)}` : "…"}
          </span>
        </div>

        {renewalShippingCents > 0 && (
          <p className="rounded-lg bg-[#152A51]/5 px-3 py-2 text-xs leading-relaxed text-[#152A51]/80">
            This first payment covers medication only. Starting with your next renewal, a $
            {(renewalShippingCents / 100).toFixed(2)} shipping fee will be added to each automatic
            payment.
          </p>
        )}
      </div>
    </Card>
  );
}
