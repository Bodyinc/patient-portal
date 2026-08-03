"use client";

import { useEffect, useState } from "react";

import { getOnboardingOrderMeta } from "@/lib/actions/intake";

export default function ConfirmationHeader() {
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [orderDate, setOrderDate] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getOnboardingOrderMeta().then((result) => {
      if (!active || !result.ok) return;
      setOrderNumber(result.data.orderNumber);
      setOrderDate(result.data.orderDate);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-4">
      <h1 className="text-[28px] font-semibold tracking-[-0.5px] text-[#152A51] sm:text-[32px]">
        Order Confirmed
      </h1>

      <p className="max-w-lg text-[15px] leading-relaxed text-[#152A51]/80 sm:text-base">
        Thank you for choosing BodyInc. Your order has been successfully received and is now being
        reviewed by our clinical team. You&apos;ll receive updates via email as your treatment
        progresses.
      </p>

      <div className="flex flex-col items-center justify-center gap-2.5 sm:flex-row sm:gap-3">
        <div className="rounded-xl border border-[#152A51]/20 bg-white px-4 py-2 text-sm font-medium text-[#152A51]">
          Order Number: {orderNumber ?? "…"}
        </div>
        <div className="rounded-xl border border-[#152A51]/20 bg-white px-4 py-2 text-sm font-medium text-[#152A51]">
          Order Date: {orderDate ?? "…"}
        </div>
      </div>
    </div>
  );
}
