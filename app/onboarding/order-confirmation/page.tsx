"use client";

import { useEffect, useRef } from "react";
import { completeIntakeSession } from "@/lib/actions/intake";

import OnboardingShell from "../_components/OnboardingShell";
import ConfirmationHeader from "./components/ConfirmationHeader";
import OrderSummary from "./components/OrderSummary";
import ActionButtons from "./components/ActionButtons";

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
    <OnboardingShell>
      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-6 overflow-y-auto py-4">
        <ConfirmationHeader />

        {/* Flex layout with items-start forces columns to maintain their natural content height */}
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          {/* Left Column - Form & Buttons area takes up remaining space */}
          <div className="w-full flex-1 flex flex-col gap-6">
            <ActionButtons />
          </div>

          {/* Right Column - Fixed desktop width for the summary card */}
          <div className="w-full md:w-[380px] shrink-0">
            <OrderSummary />
          </div>
        </div>
      </div>
    </OnboardingShell>
  );
}
