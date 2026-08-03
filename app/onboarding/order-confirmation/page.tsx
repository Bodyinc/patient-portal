"use client";

import { useEffect, useRef } from "react";
import { completeIntakeSession } from "@/lib/actions/intake";

import ConfirmationHeader from "./components/ConfirmationHeader";
import OrderSummary from "./components/OrderSummary";
import ConfirmationPasswordGate from "./components/ConfirmationPasswordGate";

export default function OrderConfirmationPage() {
  const completedRef = useRef(false);

  useEffect(() => {
    if (completedRef.current) return;
    completedRef.current = true;

    void completeIntakeSession().then((result) => {
      if (!result.ok) {
        completedRef.current = false;
      }
    });
  }, []);

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col overflow-y-auto scrollbar-hide px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
        {/* Left: confirmation copy + password / dashboard actions */}
        <div className="flex min-w-0 flex-1 flex-col items-center gap-6 text-center lg:pt-4">
          <ConfirmationHeader />
          <ConfirmationPasswordGate />
        </div>

        {/* Right: order summary */}
        <div className="mx-auto w-full max-w-[400px] shrink-0 lg:mx-0 lg:w-[380px]">
          <OrderSummary />
        </div>
      </div>
    </div>
  );
}
