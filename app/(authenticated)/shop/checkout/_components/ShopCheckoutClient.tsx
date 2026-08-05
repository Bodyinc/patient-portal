"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import ShopHeader from "../../_components/ShopHeader";
import CheckoutActions from "./CheckoutActions";
import OrderSummaryCard from "./OrderSummaryCard";
import PaymentModal from "./PaymentModal";
import PlanSelector from "./PlanSelector";
import ReferralCard from "./ReferralCard";
import SelectedProductCard from "./SelectedProductCard";
import { getCheckoutDiscount } from "@/lib/actions/stripe-checkout";
import { getShopOrderFees } from "@/lib/actions/fees";
import { getStripeJs } from "@/lib/stripe/client";
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
  savedCardLabel?: string | null;
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
  savedCardLabel = null,
}: ShopCheckoutClientProps) {
  const router = useRouter();
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
  const [appliedPromoLabel, setAppliedPromoLabel] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [payment, setPayment] = useState<{
    clientSecret: string;
    returnUrl: string;
    key: string;
  } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shipping, setShipping] = useState(0);
  const [consultation, setConsultation] = useState(0);

  // Warm the Stripe.js script as soon as the page mounts so its ~300ms network load overlaps
  // with the user choosing a plan, rather than blocking the modal the moment they click Pay.
  useEffect(() => {
    void getStripeJs();
  }, []);

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
  const walletApplied = Math.min(walletCreditCents / 100, totalBeforeCredit);
  const total = Math.max(0, totalBeforeCredit - walletApplied);
  const selectedPackageId =
    selectedPlanMeta &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      selectedPlanMeta.id,
    )
      ? selectedPlanMeta.id
      : null;

  // Identifies the Stripe subscription/order for the current plan + promo. When unchanged, we
  // reopen the existing PaymentModal instead of creating a fresh subscription on every click.
  const paymentKey = `${selectedPackageId ?? ""}|${promoCode.trim().toUpperCase()}`;

  function handleContinue() {
    if (!selectedPlanMeta) return;
    if (!selectedPackageId) {
      setError("This plan is not available for purchase yet. Please contact support.");
      return;
    }

    // Reuse the already-created subscription for this exact plan + promo.
    if (payment && payment.key === paymentKey) {
      setError(null);
      setModalOpen(true);
      return;
    }

    startCreating(async () => {
      setError(null);
      setPayment(null);
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
          clientSecret?: string | null;
          orderId?: string;
          paid?: boolean;
          error?: string;
        };
        if (!response.ok || !data.orderId) {
          throw new Error(data.error ?? "Unable to start checkout.");
        }

        if (data.paid) {
          router.push(`/shop/checkout/confirmation?orderId=${encodeURIComponent(data.orderId)}`);
          return;
        }

        if (!data.clientSecret) {
          throw new Error("Unable to start payment. Please try again.");
        }

        setPayment({
          clientSecret: data.clientSecret,
          returnUrl: `${window.location.origin}/shop/checkout/confirmation?orderId=${encodeURIComponent(
            data.orderId,
          )}`,
          key: paymentKey,
        });
        setModalOpen(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to start checkout.");
      }
    });
  }

  return (
    <div className="flex min-h-0 px-4 flex-1 flex-col gap-3 lg:overflow-hidden">
      <div className="shrink-0">
        <ShopHeader
          fullName={fullName}
          patientId={patientId}
          avatarUrl={avatarUrl}
          searchQuery=""
          currentCategorySlug={null}
          sortBy="popular"
          title={
            isUpgradeFromBilling
              ? "Upgrade Subscription"
              : isRefill
                ? "New Refill Request"
                : "Checkout"
          }
          subtitle={
            isUpgradeFromBilling
              ? "Choose a new plan for your treatment subscription."
              : isRefill
                ? "Confirm your plan and complete checkout to place your refill order."
                : "Choose your plan and complete payment."
          }
        />
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:overflow-hidden">
        <div className="min-h-0 space-y-3 lg:overflow-y-auto lg:pr-1">
          <SelectedProductCard product={bootstrap.product} />
          <PlanSelector
            plans={bootstrap.plans}
            selectedPlan={selectedPlan}
            onChange={(planId) => {
              setSelectedPlan(planId);
              setPayment(null);
              setModalOpen(false);
              if (appliedPromoLabel) {
                setAppliedPromoLabel(null);
                setPromoSavings(0);
              }
            }}
          />
          <ReferralCard
            referralHint={bootstrap.referralHint}
            promoCode={promoCode}
            appliedLabel={appliedPromoLabel}
            onPromoCodeChange={(value) => {
              setPromoCode(value);
              if (appliedPromoLabel) {
                setAppliedPromoLabel(null);
                setPromoSavings(0);
              }
            }}
            onApply={async () => {
              if (!selectedPackageId) {
                return {
                  ok: false as const,
                  message: "Select a plan before applying a promo code.",
                };
              }

              const d = await getCheckoutDiscount({
                packageId: selectedPackageId,
                code: promoCode,
                allowAuto: false,
                subtotalCents: Math.round(subtotal * 100),
              });

              if (!d) {
                setPromoSavings(0);
                setAppliedPromoLabel(null);
                return { ok: false as const, message: "Invalid or expired promo code" };
              }

              setPromoCode(promoCode.trim().toUpperCase());
              setPromoSavings(d.discountCents / 100);
              setAppliedPromoLabel(d.label);
              return { ok: true as const, label: d.label };
            }}
          />
        </div>

        <div className="flex min-h-0 flex-col gap-3 lg:overflow-y-auto">
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

          <CheckoutActions
            termsAccepted={termsAccepted}
            onTermsChange={setTermsAccepted}
            continueDisabled={isCreating}
            onContinue={handleContinue}
            backHref={backHref}
            savedCardLabel={savedCardLabel}
            continueLabel={savedCardLabel ? "Pay now" : "Continue to Payment"}
          />
        </div>
      </div>

      {payment ? (
        <PaymentModal
          open={modalOpen}
          clientSecret={payment.clientSecret}
          returnUrl={payment.returnUrl}
          onOpenChange={(open) => {
            // Keep the created subscription cached on close so reopening skips a Stripe round trip.
            setModalOpen(open);
          }}
        />
      ) : null}
    </div>
  );
}
