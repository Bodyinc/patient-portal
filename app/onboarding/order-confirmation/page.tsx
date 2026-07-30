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
    <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-6 overflow-y-auto scrollbar-hide py-4">
      <ConfirmationHeader />

      {/* Flex layout with items-start forces columns to maintain their natural content height */}
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        {/* Left Column - password setup first, then dashboard actions after success */}
        <div className="flex w-full flex-1 flex-col gap-6">
          <ConfirmationPasswordGate />
        </div>

        {/* Right Column - Fixed desktop width for the summary card */}
        <div className="w-full shrink-0 md:w-[380px]">
          <OrderSummary />
        </div>
      </div>
    </div>
  );
}
