"use client";

import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { ConfirmationData } from "../types";

type OrderSummaryProps = {
  data: ConfirmationData | null;
  loaded: boolean;
};

export default function OrderSummary({ data, loaded }: OrderSummaryProps) {
  const medicationName = data?.medicineName?.trim() || "Selected Medication";
  const variantName = data?.variantName?.trim() || null;
  const planLabel = data?.packageName?.trim() || "Treatment Plan";
  const totalPaid = data?.totalPaid;
  const renewalShippingCents = data?.renewalShippingCents ?? 0;

  return (
    <Card className="h-fit w-full overflow-hidden rounded-2xl border border-[#152A51]/20 bg-white shadow-none">
      <div className="bg-[#E8EEED] px-5 py-3.5">
        <h2 className="text-base font-semibold text-[#152A51] sm:text-lg">Order Summary</h2>
      </div>

      <div className="space-y-0 p-5">
        <div className="flex items-start justify-between gap-3 py-3 text-sm first:pt-0">
          <span className="shrink-0 text-[#152A51]/70">Selected Medication</span>
          <span className="text-right font-medium text-[#152A51]">{medicationName}</span>
        </div>

        {variantName ? (
          <>
            <Separator className="bg-[#152A51]/10" />
            <div className="flex items-start justify-between gap-3 py-3 text-sm">
              <span className="shrink-0 text-[#152A51]/70">Variant</span>
              <span className="text-right font-medium text-[#152A51]">{variantName}</span>
            </div>
          </>
        ) : null}

        <Separator className="bg-[#152A51]/10" />

        <div className="flex items-start justify-between gap-3 py-3 text-sm">
          <span className="shrink-0 text-[#152A51]/70">Selected Plan</span>
          <span className="text-right font-medium text-[#152A51]">{planLabel}</span>
        </div>

        <Separator className="bg-[#152A51]/10" />

        <div className="flex items-center justify-between gap-3 py-3 text-sm">
          <span className="text-[#152A51]/70">Consultation fee</span>
          <span className="font-semibold text-emerald-700">FREE</span>
        </div>

        <Separator className="bg-[#152A51]/10" />

        <div className="flex items-center justify-between gap-3 py-3 text-sm">
          <span className="text-[#152A51]/70">Shipping</span>
          <span className="font-semibold text-emerald-700">FREE</span>
        </div>

        <Separator className="bg-[#152A51]/10" />

        <div className="flex items-center justify-between gap-3 pt-4">
          <span className="text-base font-semibold text-[#152A51]">Total Paid</span>
          <span className="text-[28px] font-semibold tracking-[-0.5px] text-[#152A51] sm:text-[32px]">
            {loaded && totalPaid != null ? `$${totalPaid.toFixed(2)}` : loaded ? "—" : "…"}
          </span>
        </div>

        {renewalShippingCents > 0 ? (
          <p className="mt-4 rounded-xl bg-[#E8EEED]/80 px-3.5 py-3 text-[12px] leading-relaxed text-[#152A51]/75">
            This first payment covers medication only. Starting with your next renewal, a $
            {(renewalShippingCents / 100).toFixed(2)} shipping fee will be added to each automatic
            payment.
          </p>
        ) : null}
      </div>
    </Card>
  );
}
