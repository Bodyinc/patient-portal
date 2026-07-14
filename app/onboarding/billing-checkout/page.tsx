"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { createOnboardingSubscription, getCheckoutDiscount } from "@/lib/actions/stripe-checkout";
import {
  claimCheckoutForCurrentUser,
  preparePostCheckoutAccount,
} from "@/lib/actions/patient-auth";
import { createClient } from "@/lib/supabase/client";

import OnboardingShell from "../_components/OnboardingShell";
import OnboardingFooter from "../_components/OnboardingFooter";
import OnboardingFrame from "../_components/OnboardingFrame";
import PageHeader from "./components/PageHeader";
import InfoCard from "./components/InfoCard";
import PaymentForm from "./components/PaymentForm";
import OnboardingPaymentForm from "./components/OnboardingPaymentForm";
import OrderSummary from "./components/OrderSummary";
import TermsCheckbox from "./components/TermsCheckbox";
import { useIntakeSummary } from "../_hooks/use-intake-catalog";
import { calculateCheckoutPricing } from "../_lib/intake-pricing";
import { getStateName } from "../_lib/onboarding-config";
import { getPrevStepPath } from "../_lib/onboarding-navigation";
import { useOnboarding } from "../_lib/onboarding-store";

const ORDER_CONFIRMATION_REDIRECT = "/order-confirmation";

export default function BillingCheckoutPage() {
  const router = useRouter();
  const supabase = createClient();
  const { state, updateState } = useOnboarding();
  const { data: summary } = useIntakeSummary();
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(null);
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [promoMessage, setPromoMessage] = useState<string | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountLabel, setDiscountLabel] = useState<string | null>(null);

  const packageId = summary?.selectedPackageId ?? null;
  const medicationName = summary?.medicineName ?? "Selected Medication";
  const planLabel = summary?.packageName ?? "Treatment Plan";
  const pricing = useMemo(
    () => calculateCheckoutPricing(summary?.packagePrice, discountAmount, discountLabel),
    [summary?.packagePrice, discountAmount, discountLabel],
  );

  useEffect(() => {
    if (!packageId) return;
    let active = true;
    void getCheckoutDiscount({ packageId, code: appliedPromoCode, allowAuto: true }).then((d) => {
      if (!active) return;
      setDiscountAmount(d ? d.discountCents / 100 : 0);
      setDiscountLabel(d?.label ?? null);
    });
    return () => {
      active = false;
    };
  }, [packageId, appliedPromoCode]);

  async function handleApplyPromo() {
    setPromoError(null);
    setPromoMessage(null);
    if (!packageId) return;
    setApplyingPromo(true);
    const d = await getCheckoutDiscount({ packageId, code: promoCode, allowAuto: false });
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

  async function handleContinueToPayment() {
    if (!consentAccepted) {
      toast.error("Please accept the Terms & Conditions and Privacy Policy to continue");
      return;
    }

    setConfirming(true);
    const result = await createOnboardingSubscription(appliedPromoCode);
    setConfirming(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    setClientSecret(result.clientSecret);
    toast.success("Enter your card details below to complete payment.");
  }

  async function handlePaid() {
    setConfirming(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await claimCheckoutForCurrentUser();
      updateState({ checkoutConfirmed: true });
      toast.success("Payment confirmed.");
      router.push(ORDER_CONFIRMATION_REDIRECT);
      return;
    }

    const accountResult = await preparePostCheckoutAccount();
    if (!accountResult.ok) {
      setConfirming(false);
      toast.error(accountResult.message);
      return;
    }

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: accountResult.email,
    });

    if (otpError) {
      setConfirming(false);
      toast.error(otpError.message);
      return;
    }

    updateState({ checkoutConfirmed: true });
    toast.success("Payment confirmed. We sent a login code to your email.");

    router.push(
      `/verify-otp?email=${encodeURIComponent(accountResult.email)}&redirect=${encodeURIComponent(ORDER_CONFIRMATION_REDIRECT)}`,
    );
  }

  function handleBack() {
    const prev = getPrevStepPath("/onboarding/billing-checkout", state);
    if (prev) router.push(prev);
  }

  return (
    <OnboardingShell>
      <OnboardingFrame
        showProgress={false}
        footer={<OnboardingFooter onBack={handleBack} showContinue={false} />}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden lg:gap-3">
          <PageHeader />

          {}
          <div className="grid min-h-0 flex-1 grid-cols-1 items-start gap-2 overflow-hidden lg:grid-cols-[1.65fr_1fr] lg:gap-4">
            <div className="flex min-h-0 flex-col gap-2 overflow-hidden">
              <div className="grid shrink-0 grid-cols-1 gap-2 sm:grid-cols-2">
                <InfoCard
                  title="Patient Information"
                  items={[
                    { label: "Name", value: summary?.fullName || state.fullName || "—" },
                    { label: "Email Address", value: summary?.email || state.email || "—" },
                    { label: "Phone Number", value: summary?.phone || state.phone || "—" },
                  ]}
                />

                <InfoCard
                  title="Clinical Profile"
                  items={[
                    {
                      label: "State",
                      value: getStateName(summary?.stateCode ?? state.state) || "—",
                    },
                    { label: "Date of Birth", value: summary?.dob || state.dob || "—" },
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

              <div className="min-h-0 flex-1">
                {clientSecret ? (
                  <OnboardingPaymentForm
                    clientSecret={clientSecret}
                    returnUrl={`${
                      typeof window !== "undefined" ? window.location.origin : ""
                    }/onboarding/checkout-complete`}
                    onPaid={() => void handlePaid()}
                  />
                ) : (
                  <PaymentForm />
                )}
              </div>

              <TermsCheckbox checked={consentAccepted} onChange={setConsentAccepted} />
            </div>

            <OrderSummary
              medicationName={medicationName}
              planLabel={planLabel}
              medicationTotal={pricing.medicationTotal}
              subtotal={pricing.subtotal}
              discount={pricing.discount}
              discountLabel={pricing.discountLabel}
              total={pricing.total}
              promoCode={promoCode}
              promoMessage={promoMessage}
              promoError={promoError}
              applyingPromo={applyingPromo}
              consentAccepted={consentAccepted}
              confirming={confirming}
              loading={summary?.packagePrice == null}
              hideContinue={Boolean(clientSecret)}
              onPromoCodeChange={(value) => {
                setPromoCode(value);
                setPromoError(null);
                setPromoMessage(null);
              }}
              onApplyPromo={handleApplyPromo}
              onContinue={() => void handleContinueToPayment()}
            />
          </div>
        </div>
      </OnboardingFrame>
    </OnboardingShell>
  );
}
