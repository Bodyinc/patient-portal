"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import ShopHeader from "../../_components/ShopHeader";
import CheckoutActions from "./CheckoutActions";
import OrderSummaryCard from "./OrderSummaryCard";
import PlanSelector from "./PlanSelector";
import ReferralCard from "./ReferralCard";
import SelectedProductCard from "./SelectedProductCard";
import StripePaymentForm from "./StripePaymentForm";
import { getCheckoutDiscount } from "@/lib/actions/stripe-checkout";
import { getShopOrderFees } from "@/lib/actions/fees";
import type { CheckoutBootstrap, CheckoutPlanId } from "./types";

type ShopCheckoutClientProps = {
  bootstrap: CheckoutBootstrap;
  medicineId: string;
  fullName: string;
  patientId: string;
  avatarUrl: string | null;
  from?: string | null;
  initialPackageId?: string | null;
  walletCreditCents?: number;
};

function checkoutBackHref(from: string | null | undefined): string {
  if (from === "billing") return "/billing";
  if (from === "my-meds") return "/my-meds";
  if (from === "dashboard") return "/dashboard";
  return "/shop";
}

export default function ShopCheckoutClient({
  bootstrap,
  medicineId,
  fullName,
  patientId,
  avatarUrl,
  from,
  initialPackageId,
  walletCreditCents = 0,
}: ShopCheckoutClientProps) {
  const isUpgradeFromBilling = from === "billing";
  const isRefill = from === "dashboard" || from === "my-meds";
  const backHref = checkoutBackHref(from);
  const [isCreating, startCreating] = useTransition();
  const [selectedPlan, setSelectedPlan] = useState<CheckoutPlanId>(() => {
    if (initialPackageId && bootstrap.plans.some((plan) => plan.id === initialPackageId)) {
      return initialPackageId;
    }
    return bootstrap.defaultSelectedPlan;
  });
  const [promoCode, setPromoCode] = useState("");
  const [promoSavings, setPromoSavings] = useState(0);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [payment, setPayment] = useState<{ clientSecret: string; returnUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shipping, setShipping] = useState(0);
  const [consultation, setConsultation] = useState(0);

  useEffect(() => {
    let active = true;
    void getShopOrderFees(medicineId).then((f) => {
      if (!active) return;
      setShipping(f.shippingCents / 100);
      setConsultation(f.consultationCents / 100);
    });
    return () => {
      active = false;
    };
  }, [medicineId]);

  const selectedPlanMeta = useMemo(
    () => bootstrap.plans.find((plan) => plan.id === selectedPlan) ?? bootstrap.plans[0],
    [bootstrap.plans, selectedPlan],
  );

  const subtotal = useMemo(
    () => selectedPlanMeta?.amount ?? bootstrap.product.baseMonthlyPrice,
    [bootstrap.product.baseMonthlyPrice, selectedPlanMeta],
  );
  const totalBeforeCredit = Math.max(0, subtotal - promoSavings + shipping + consultation);
  // Stripe consumes wallet credit automatically at payment; mirror it here so the
  // displayed total matches the actual charge.
  const walletApplied = Math.min(walletCreditCents / 100, totalBeforeCredit);
  const total = Math.max(0, totalBeforeCredit - walletApplied);
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
    <div className="space-y-4">
      <ShopHeader
        fullName={fullName}
        patientId={patientId}
        avatarUrl={avatarUrl}
        searchQuery=""
        currentCategorySlug={null}
        sortBy="popular"
      />

      {isUpgradeFromBilling ? (
        <section className="space-y-1 px-1">
          <h1 className="text-xl font-medium tracking-[-0.5px] text-[#152A51] sm:text-2xl">
            Upgrade Subscription
          </h1>
          <p className="text-sm text-[#152A51]/70">
            Choose a new plan for your treatment subscription.
          </p>
        </section>
      ) : null}

      {isRefill ? (
        <section className="space-y-1 px-1">
          <h1 className="text-xl font-medium tracking-[-0.5px] text-[#152A51] sm:text-2xl">
            New Refill Request
          </h1>
          <p className="text-sm text-[#152A51]/70">
            Confirm your plan and complete checkout to place your refill order.
          </p>
        </section>
      ) : null}

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
        onApply={async () => {
          if (!selectedPackageId) return;
          const d = await getCheckoutDiscount({
            packageId: selectedPackageId,
            code: promoCode,
            allowAuto: false,
          });
          setPromoSavings(d ? d.discountCents / 100 : 0);
        }}
      />
      <OrderSummaryCard
        subtotal={subtotal}
        promoSavings={promoSavings}
        walletApplied={walletApplied}
        shipping={shipping}
        consultation={consultation}
        total={total}
      />

      {error ? (
        <p className="rounded-[16px] border border-red-200 bg-red-50 p-3 text-sm text-red-700">
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
          backHref={backHref}
        />
      )}
    </div>
  );
}
