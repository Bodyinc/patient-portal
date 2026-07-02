"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createShopCheckoutOrder } from "@/lib/shop/client";
import ShopHeader from "../../_components/ShopHeader";
import CheckoutActions from "./CheckoutActions";
import OrderSummaryCard from "./OrderSummaryCard";
import PaymentMethodsSection from "./PaymentMethodsSection";
import PlanSelector from "./PlanSelector";
import ReferralCard from "./ReferralCard";
import SelectedProductCard from "./SelectedProductCard";
import type { CheckoutBootstrap, CheckoutPaymentMethodId, CheckoutPlanId } from "./types";

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
  const router = useRouter();
  const [isCreating, startCreating] = useTransition();
  const [selectedPlan, setSelectedPlan] = useState<CheckoutPlanId>(bootstrap.defaultSelectedPlan);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<CheckoutPaymentMethodId>(
    bootstrap.paymentMethods[0]?.id ?? "card",
  );
  const [promoCode, setPromoCode] = useState("");
  const [promoSavings, setPromoSavings] = useState(0);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const selectedPlanMeta = useMemo(
    () => bootstrap.plans.find((plan) => plan.code === selectedPlan) ?? bootstrap.plans[0],
    [bootstrap.plans, selectedPlan],
  );

  const subtotal = useMemo(
    () => selectedPlanMeta?.amount ?? bootstrap.product.baseMonthlyPrice,
    [bootstrap.product.baseMonthlyPrice, selectedPlanMeta],
  );
  const total = Math.max(0, subtotal - promoSavings);
  const selectedPackageId =
    selectedPlanMeta &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      selectedPlanMeta.id,
    )
      ? selectedPlanMeta.id
      : null;

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
      <PaymentMethodsSection
        methods={bootstrap.paymentMethods}
        selectedMethod={selectedPaymentMethod}
        onSelect={setSelectedPaymentMethod}
      />
      <ReferralCard
        referralHint={bootstrap.referralHint}
        promoCode={promoCode}
        onPromoCodeChange={setPromoCode}
        onApply={() => {
          setPromoSavings(promoCode.trim().toUpperCase() === "SAVE50" ? 50 : 0);
        }}
      />
      <OrderSummaryCard subtotal={subtotal} promoSavings={promoSavings} total={total} />
      <CheckoutActions
        termsAccepted={termsAccepted}
        onTermsChange={setTermsAccepted}
        continueDisabled={isCreating}
        onContinue={() => {
          if (!selectedPlanMeta) return;
          startCreating(async () => {
            try {
              const order = await createShopCheckoutOrder({
                medicineId,
                packageId: selectedPackageId,
                selectedPlanCode: selectedPlanMeta.code,
                paymentMethodCode: selectedPaymentMethod,
                promoCode: promoCode.trim() || null,
                promoSavings,
                subtotal,
                shipping: 0,
                total,
              });
              router.push(`/shop/checkout/confirmation?orderId=${encodeURIComponent(order.id)}`);
            } catch (error) {
              window.alert(error instanceof Error ? error.message : "Unable to create order.");
            }
          });
        }}
      />
    </div>
  );
}
