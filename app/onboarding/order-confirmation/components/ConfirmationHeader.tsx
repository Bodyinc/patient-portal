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
    <div className="space-y-3 text-center">
      <h1 className="text-2xl font-semibold text-[#152A51]">Order Confirmed</h1>

      <p className="mx-auto max-w-2xl text-base text-[#152A51]/80">
        Thank you for choosing BodyInc. Your order has been successfully received and is now being
        reviewed by our clinical team. You&apos;ll receive updates via email as your treatment
        progresses.
      </p>

      <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
        <div className="rounded-md border border-[#152A51]/25 px-4 py-1.5 text-sm font-medium text-[#152A51]">
          Order Number: {orderNumber ?? "…"}
        </div>
        <div className="rounded-md border border-[#152A51]/25 px-4 py-1.5 text-sm font-medium text-[#152A51]">
          Order Date: {orderDate ?? "…"}
        </div>
      </div>
    </div>
  );
}
