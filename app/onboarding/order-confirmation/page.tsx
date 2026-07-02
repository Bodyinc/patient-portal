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
      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col justify-center gap-6 overflow-y-auto py-4">
        <ConfirmationHeader />
        <OrderSummary />
        <ActionButtons />
      </div>
    </OnboardingShell>
  );
}
