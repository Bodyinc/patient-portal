"use client";

import { useMemo, useState, useTransition } from "react";

import ShopHeader from "../../_components/ShopHeader";
import CheckoutActions from "./CheckoutActions";
import OrderSummaryCard from "./OrderSummaryCard";
import PlanSelector from "./PlanSelector";
import ReferralCard from "./ReferralCard";
import SelectedProductCard from "./SelectedProductCard";
import StripePaymentForm from "./StripePaymentForm";
import { PROCESSING_FEE_CENTS } from "@/lib/stripe/fees";
import type { CheckoutBootstrap, CheckoutPlanId } from "./types";

const PROCESSING_FEE = PROCESSING_FEE_CENTS / 100;

type ShopCheckoutClientProps = {
  bootstrap: CheckoutBootstrap;
  medicineId: string;
  fullName: string;
  patientId: string;
  avatarUrl: string | null;
};

export default function ShopCheckoutClient({
  bootstrap,
  medicineId,
  fullName,
  patientId,
  avatarUrl,
}: ShopCheckoutClientProps) {
  const [isCreating, startCreating] = useTransition();
  const [selectedPlan, setSelectedPlan] = useState<CheckoutPlanId>(bootstrap.defaultSelectedPlan);
  const [promoCode, setPromoCode] = useState("");
  const [promoSavings, setPromoSavings] = useState(0);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [payment, setPayment] = useState<{ clientSecret: string; returnUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedPlanMeta = useMemo(
    () => bootstrap.plans.find((plan) => plan.code === selectedPlan) ?? bootstrap.plans[0],
    [bootstrap.plans, selectedPlan],
  );

  const subtotal = useMemo(
    () => selectedPlanMeta?.amount ?? bootstrap.product.baseMonthlyPrice,
    [bootstrap.product.baseMonthlyPrice, selectedPlanMeta],
  );
  const total = Math.max(0, subtotal + PROCESSING_FEE - promoSavings);
  const selectedPackageId =
    selectedPlanMeta &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      selectedPlanMeta.id,
    )
      ? selectedPlanMeta.id
      : null;

  function handleContinue() {
    if (!selectedPlanMeta) return;
    if (!selectedPackageId) {
      setError("This plan is not available for purchase yet. Please contact support.");
      return;
    }

    startCreating(async () => {
      setError(null);
      try {
        const response = await fetch("/api/stripe/subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            medicineId,
            packageId: selectedPackageId,
            promoCode: promoCode.trim() || null,
          }),
        });
        const data = (await response.json()) as {
          clientSecret?: string;
          orderId?: string;
          error?: string;
        };
        if (!response.ok || !data.clientSecret || !data.orderId) {
          throw new Error(data.error ?? "Unable to start checkout.");
        }
        setPayment({
          clientSecret: data.clientSecret,
          returnUrl: `${window.location.origin}/shop/checkout/confirmation?orderId=${encodeURIComponent(
            data.orderId,
          )}`,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to start checkout.");
      }
    });
  }

  return (
    <div className="space-y-3">
      <ShopHeader
        fullName={fullName}
        patientId={patientId}
        avatarUrl={avatarUrl}
        searchQuery=""
        currentCategorySlug={null}
        sortBy="popular"
      />

      <SelectedProductCard product={bootstrap.product} />
      <PlanSelector
        plans={bootstrap.plans}
        selectedPlan={selectedPlan}
        onChange={setSelectedPlan}
      />
      <ReferralCard
        referralHint={bootstrap.referralHint}
        promoCode={promoCode}
        onPromoCodeChange={setPromoCode}
        onApply={() => {
          setPromoSavings(promoCode.trim().toUpperCase() === "SAVE50" ? 50 : 0);
        }}
      />
      <OrderSummaryCard
        subtotal={subtotal}
        processingFee={PROCESSING_FEE}
        promoSavings={promoSavings}
        total={total}
      />

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {payment ? (
        <StripePaymentForm clientSecret={payment.clientSecret} returnUrl={payment.returnUrl} />
      ) : (
        <CheckoutActions
          termsAccepted={termsAccepted}
          onTermsChange={setTermsAccepted}
          continueDisabled={isCreating}
          onContinue={handleContinue}
        />
      )}
    </div>
  );
}
