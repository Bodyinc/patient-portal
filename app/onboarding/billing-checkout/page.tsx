"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  createOnboardingSubscription,
  getCheckoutDiscount,
  type OnboardingSubscriptionResult,
} from "@/lib/actions/stripe-checkout";
import { getPublicFees } from "@/lib/actions/fees";
import { claimCheckoutForCurrentUser } from "@/lib/actions/patient-auth";
import { getStripeJs } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/client";

import OnboardingFooter from "../_components/OnboardingFooter";
import OnboardingFrame from "../_components/OnboardingFrame";
import PageHeader from "./components/PageHeader";
import InfoCard from "./components/InfoCard";
import OnboardingPaymentForm from "./components/OnboardingPaymentForm";
import OrderSummary from "./components/OrderSummary";
import PaymentFormSkeleton from "./components/PaymentFormSkeleton";
import TermsCheckbox from "./components/TermsCheckbox";
import CheckoutReassurance from "./components/CheckoutReassurance";
import { useIntakeSummary } from "../_hooks/use-intake-catalog";
import { finishGuestCheckoutSession } from "../_lib/finish-guest-checkout";
import { calculateCheckoutPricing } from "../_lib/intake-pricing";
import { getStateName } from "../_lib/onboarding-config";
import { getPrevStepPath } from "../_lib/onboarding-navigation";
import { useOnboarding } from "../_lib/onboarding-store";
import { formatIsoDate } from "@/lib/date-format";

const ORDER_CONFIRMATION_REDIRECT = "/onboarding/order-confirmation";

/** Module-level cache so Strict Mode remounts reuse the same in-flight subscription create. */
const paymentInitCache = new Map<string, Promise<OnboardingSubscriptionResult>>();

function getPaymentInitPromise(
  packageId: string,
  promoCode: string | null,
  retryToken: number,
  cartKey: string,
): Promise<OnboardingSubscriptionResult> {
  const key = `${packageId}::${cartKey}::${promoCode ?? ""}::${retryToken}`;
  let pending = paymentInitCache.get(key);
  if (!pending) {
    pending = createOnboardingSubscription(promoCode);
    paymentInitCache.set(key, pending);
    // Drop failed entries so retry can recreate.
    pending.then((result) => {
      if (!result.ok) paymentInitCache.delete(key);
    });
  }
  return pending;
}

export default function BillingCheckoutPage() {
  const router = useRouter();
  const supabase = createClient();
  const { state, updateState } = useOnboarding();
  const { data: summary } = useIntakeSummary();
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [termsHighlighted, setTermsHighlighted] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(true);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(null);
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [promoMessage, setPromoMessage] = useState<string | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountLabel, setDiscountLabel] = useState<string | null>(null);
  const [consultationFeeCents, setConsultationFeeCents] = useState(0);
  const [renewalShippingCents, setRenewalShippingCents] = useState(0);
  const [retryToken, setRetryToken] = useState(0);
  const [finishWithoutCard, setFinishWithoutCard] = useState(false);
  const paymentInitSeq = useRef(0);
  const finishedWithoutCard = useRef(false);
  const termsRef = useRef<HTMLDivElement>(null);
  const paymentRef = useRef<HTMLDivElement>(null);

  // Warm Stripe.js as soon as the checkout page mounts.
  useEffect(() => {
    void getStripeJs();
  }, []);

  useEffect(() => {
    let active = true;
    void getPublicFees().then((f) => {
      if (!active) return;
      setRenewalShippingCents(f.shippingFeeCents);
      setConsultationFeeCents(f.consultationFeeCents);
    });
    return () => {
      active = false;
    };
  }, []);

  const packageId = summary?.selectedPackageId ?? null;
  const cartItems = summary?.cartItems ?? [];
  const pricedCart = cartItems.filter((item) => item.packagePrice != null);
  const cartKey = pricedCart
    .filter((item) => !item.isPrimary && item.packageId)
    .map((item) => item.packageId)
    .sort()
    .join(",");
  const cartSubtotal =
    pricedCart.length > 0
      ? pricedCart.reduce((sum, item) => sum + (item.packagePrice ?? 0), 0)
      : summary?.packagePrice;
  const cartOriginal =
    pricedCart.length > 0
      ? pricedCart.reduce(
          (sum, item) => sum + (item.packageOriginalPrice ?? item.packagePrice ?? 0),
          0,
        )
      : summary?.packageOriginalPrice;
  const summaryLines = pricedCart.map((item) => ({
    name: item.variantName ? `${item.medicineName} — ${item.variantName}` : item.medicineName,
    planLabel: item.packageName ?? item.categoryName,
    amount: item.packagePrice ?? 0,
  }));
  const medicationName =
    summaryLines.length > 1
      ? summaryLines.map((line) => line.name).join(", ")
      : (summary?.medicineName ?? "Selected Medication") +
        (summary?.variantName ? ` — ${summary.variantName}` : "");
  const planLabel =
    summaryLines.length > 1 ? "One checkout" : (summary?.packageName ?? "Treatment Plan");
  const pricing = useMemo(
    () => calculateCheckoutPricing(cartSubtotal, discountAmount, discountLabel, cartOriginal),
    [cartSubtotal, cartOriginal, discountAmount, discountLabel],
  );

  useEffect(() => {
    if (!packageId) return;
    let active = true;
    void getCheckoutDiscount({
      packageId,
      code: appliedPromoCode,
      allowAuto: true,
      subtotalCents: cartSubtotal != null ? Math.round(cartSubtotal * 100) : undefined,
    }).then((d) => {
      if (!active) return;
      setDiscountAmount(d ? d.discountCents / 100 : 0);
      setDiscountLabel(d?.label ?? null);
    });
    return () => {
      active = false;
    };
  }, [packageId, appliedPromoCode, cartSubtotal]);

  // Preload Stripe Payment Element as soon as the package is known.
  useEffect(() => {
    if (!packageId) return;

    const seq = ++paymentInitSeq.current;
    let cancelled = false;

    setPaymentLoading(true);
    setPaymentError(null);
    setClientSecret(null);

    void getPaymentInitPromise(packageId, appliedPromoCode, retryToken, cartKey).then((result) => {
      if (cancelled || seq !== paymentInitSeq.current) return;
      if (!result.ok) {
        setPaymentError(result.message);
        setPaymentLoading(false);
        return;
      }
      if (result.paid) {
        setPaymentLoading(false);
        setFinishWithoutCard(true);
        return;
      }
      setClientSecret(result.clientSecret);
      setPaymentLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [packageId, appliedPromoCode, retryToken, cartKey]);

  const retryPaymentInit = useCallback(() => {
    setRetryToken((t) => t + 1);
  }, []);

  async function handleApplyPromo() {
    setPromoError(null);
    setPromoMessage(null);
    if (!packageId) return;
    setApplyingPromo(true);
    const d = await getCheckoutDiscount({
      packageId,
      code: promoCode,
      allowAuto: false,
      subtotalCents: cartSubtotal != null ? Math.round(cartSubtotal * 100) : undefined,
    });
    setApplyingPromo(false);

    if (!d) {
      setPromoError("Invalid or expired promo code");
      return;
    }

    setAppliedPromoCode(promoCode.trim().toUpperCase());
    setDiscountAmount(d.discountCents / 100);
    setDiscountLabel(d.label);
    setPromoMessage(`Promo ${d.label} applied`);
    toast.success(`Promo ${d.label} applied`);
  }

  async function handlePaid() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await claimCheckoutForCurrentUser();
      // Reaching successful payment proves every prior onboarding gate was completed.
      // Persist questionnaire completion too so stale client state cannot send the
      // patient backward while navigating to confirmation.
      updateState({ questionnaireComplete: true, checkoutConfirmed: true });
      toast.success("Payment confirmed.");
      router.push(ORDER_CONFIRMATION_REDIRECT);
      return;
    }

    const sessionResult = await finishGuestCheckoutSession();
    if (!sessionResult.ok) {
      toast.error(sessionResult.message);
      return;
    }

    updateState({ questionnaireComplete: true, checkoutConfirmed: true });
    toast.success("Payment confirmed.");
    router.push(ORDER_CONFIRMATION_REDIRECT);
  }

  useEffect(() => {
    if (!finishWithoutCard || finishedWithoutCard.current) return;
    finishedWithoutCard.current = true;
    void handlePaid();
  }, [finishWithoutCard]);

  const paymentReady = Boolean(clientSecret) && !paymentLoading && !paymentError;
  const showPayment = paymentOpen && consentAccepted;
  const showSkeleton = showPayment && !paymentError && !paymentReady;
  const skeletonHint = paymentLoading || !packageId ? "Loading payment form…" : "Updating payment…";

  function handleConsentChange(accepted: boolean) {
    setConsentAccepted(accepted);
    if (accepted) {
      setTermsHighlighted(false);
      return;
    }
    setPaymentOpen(false);
  }

  function handleProceedToPayment() {
    if (!consentAccepted) {
      setTermsHighlighted(true);
      termsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      termsRef.current?.querySelector<HTMLInputElement>("input")?.focus();
      return;
    }
    setTermsHighlighted(false);
    setPaymentOpen(true);
    requestAnimationFrame(() => {
      paymentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const returnUrl = `${
    typeof window !== "undefined" ? window.location.origin : ""
  }/onboarding/checkout-complete`;

  return (
    <OnboardingFrame
      showProgress={false}
      footer={
        <OnboardingFooter
          backHref={getPrevStepPath("/onboarding/billing-checkout", state)}
          showContinue={false}
          variant="figma"
        />
      }
    >
      {/* Wrapper scrolls on small screens; desktop keeps the original fixed two-column layout. */}
      <div className="flex h-full w-full flex-col gap-2 overflow-y-auto scrollbar-hide lg:gap-3 lg:overflow-hidden">
        <PageHeader />

        <div className="grid min-h-0 flex-1 grid-cols-1 items-start gap-3 overflow-y-auto scrollbar-hide pb-4 lg:grid-cols-[1.65fr_1fr] lg:gap-4 lg:overflow-hidden lg:pb-0">
          <div className="flex flex-col gap-3 scrollbar-hide lg:h-full lg:overflow-y-auto lg:pr-0">
            <div className="grid shrink-0 grid-cols-1 gap-2 sm:grid-cols-2">
              <InfoCard
                title="Patient Information"
                items={[
                  { label: "Name", value: summary?.fullName || state.fullName || "—" },
                  { label: "Email Address", value: summary?.email || state.email || "—" },
                  {
                    label: "Phone Number",
                    value:
                      summary?.phone || state.phone
                        ? `${summary?.phoneCountryCode || state.phoneCountryCode || "+1"} ${summary?.phone || state.phone}`
                        : "—",
                  },
                ]}
              />

              <InfoCard
                title="Clinical Profile"
                items={[
                  {
                    label: "State",
                    value: getStateName(summary?.stateCode ?? state.state) || "—",
                  },
                  {
                    label: "Date of Birth",
                    value: formatIsoDate(summary?.dob || state.dob || null),
                  },
                  {
                    label: "BMI",
                    value:
                      summary?.bmi !== null && summary?.bmi !== undefined
                        ? String(summary.bmi)
                        : state.bmi !== null
                          ? String(state.bmi)
                          : "—",
                  },
                ]}
              />
            </div>

            <div ref={termsRef}>
              <TermsCheckbox
                checked={consentAccepted}
                invalid={termsHighlighted && !consentAccepted}
                onChange={handleConsentChange}
              />
              {showPayment ? null : (
                <button
                  type="button"
                  onClick={handleProceedToPayment}
                  className="mt-3 h-[46px] w-full rounded-full bg-[#E3E084] text-[14px] font-medium text-[#152A51] transition hover:bg-[#D9D674]"
                >
                  Proceed to payment
                </button>
              )}
            </div>

            <div ref={paymentRef} className="relative shrink-0">
              {paymentError && showPayment ? (
                <div className="rounded-[14px] border border-[#E8E8E8] bg-white p-4 onboarding-font">
                  <h2 className="mb-2 text-[15px] font-medium text-[#152A51] sm:text-[16px]">
                    Payment Details
                  </h2>
                  <div className="space-y-2">
                    <p className="text-[13px] text-red-600">{paymentError}</p>
                    <button
                      type="button"
                      onClick={retryPaymentInit}
                      className="text-[13px] font-medium text-[#152A51] underline"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Mount as soon as the patient proceeds so Stripe iframes can finish warming. */}
              {clientSecret && showPayment && !paymentError ? (
                <div>
                  <OnboardingPaymentForm
                    key={clientSecret}
                    clientSecret={clientSecret}
                    returnUrl={returnUrl}
                    consentAccepted={consentAccepted}
                    onPaid={() => void handlePaid()}
                  />
                </div>
              ) : null}

              {showSkeleton ? (
                <div
                  className={
                    clientSecret && !paymentError
                      ? "absolute inset-0 z-10 overflow-hidden rounded-[14px] bg-white"
                      : undefined
                  }
                >
                  <PaymentFormSkeleton hint={skeletonHint} />
                </div>
              ) : null}
            </div>

            <CheckoutReassurance />
          </div>

          {/* Original right-column scrolling is retained for shorter desktop viewports. */}
          <div className="w-full scrollbar-hide lg:h-full lg:overflow-y-auto">
            <OrderSummary
              medicationName={medicationName}
              planLabel={planLabel}
              medicationTotal={pricing.medicationTotal}
              medicationOriginalTotal={pricing.medicationOriginalTotal}
              subtotal={pricing.subtotal}
              discount={pricing.discount}
              discountLabel={pricing.discountLabel}
              total={pricing.total}
              totalSavings={pricing.totalSavings}
              promoCode={promoCode}
              promoMessage={promoMessage}
              promoError={promoError}
              applyingPromo={applyingPromo}
              lines={summaryLines}
              loading={cartSubtotal == null}
              consultationFeeCents={consultationFeeCents}
              renewalShippingCents={renewalShippingCents}
              onPromoCodeChange={(value) => {
                setPromoCode(value);
                setPromoError(null);
                setPromoMessage(null);
              }}
              onApplyPromo={handleApplyPromo}
            />
          </div>
        </div>
      </div>
    </OnboardingFrame>
  );
}
