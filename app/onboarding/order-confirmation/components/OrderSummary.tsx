"use client";

import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import { useIntakeSummary } from "../../_hooks/use-intake-catalog";
import { calculateCheckoutPricing } from "../../_lib/intake-pricing";

export default function OrderSummary() {
  const { data: summary } = useIntakeSummary();

  const medicationName = summary?.medicineName ?? "Selected Medication";
  const planLabel = summary?.packageName ?? "Treatment Plan";
  const loaded = summary?.packagePrice != null;
  const pricing = calculateCheckoutPricing(summary?.packagePrice, summary?.packageDurationMonths);

  return (
    <Card className="overflow-hidden rounded-2xl border border-[#2E00AB]/25 shadow-none">
      <div className="bg-[#EDE7FA] px-5 py-3">
        <h2 className="text-lg font-semibold text-[#2E00AB]">Order Summary</h2>
      </div>

      <div className="space-y-4 p-5">
        <div className="flex justify-between text-sm">
          <span className="text-[#2E00AB]/80">Selected Medication</span>
          <span className="text-base text-[#2E00AB]">{medicationName}</span>
        </div>

        <Separator />

        <div className="flex justify-between text-sm">
          <span className="text-[#2E00AB]/80">Selected Plan</span>
          <span className="text-base text-[#2E00AB]">{planLabel}</span>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <span className="text-base font-medium text-[#2E00AB]">Total Paid</span>
          <span className="text-3xl font-semibold text-[#2E00AB]">
            {loaded ? `$${pricing.total.toFixed(2)}` : "…"}
          </span>
        </div>
      </div>
    </Card>
  );
}
