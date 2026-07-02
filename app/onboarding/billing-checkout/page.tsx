"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { confirmCheckoutStub } from "@/lib/actions/intake";
import { preparePostCheckoutAccount } from "@/lib/actions/patient-auth";
import { createClient } from "@/lib/supabase/client";

import OnboardingShell from "../_components/OnboardingShell";
import OnboardingFooter from "../_components/OnboardingFooter";
import OnboardingFrame from "../_components/OnboardingFrame";
import PageHeader from "./components/PageHeader";
import InfoCard from "./components/InfoCard";
import PaymentForm from "./components/PaymentForm";
import OrderSummary from "./components/OrderSummary";
import TermsCheckbox from "./components/TermsCheckbox";
import { useIntakeSummary } from "../_hooks/use-intake-catalog";
import { calculateCheckoutPricing, validatePromoCode } from "../_lib/intake-pricing";
import { getStateName } from "../_lib/onboarding-config";
import { getPrevStepPath } from "../_lib/onboarding-navigation";
import { useOnboarding } from "../_lib/onboarding-store";

const ORDER_CONFIRMATION_REDIRECT = "/onboarding/order-confirmation";

export default function BillingCheckoutPage() {
  const router = useRouter();
  const supabase = createClient();
  const { state, updateState } = useOnboarding();
  const { data: summary } = useIntakeSummary();
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(null);
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [promoMessage, setPromoMessage] = useState<string | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);

  const medicationName = summary?.medicineName ?? "Selected Medication";
  const planLabel = summary?.packageName ?? "Treatment Plan";
  const pricing = useMemo(
    () =>
      calculateCheckoutPricing(
        summary?.packagePrice,
        summary?.packageDurationMonths,
        appliedPromoCode,
      ),
    [summary?.packagePrice, summary?.packageDurationMonths, appliedPromoCode],
  );

  function handleApplyPromo() {
    setPromoError(null);
    setPromoMessage(null);
    setApplyingPromo(true);

    const result = validatePromoCode(promoCode);
    setApplyingPromo(false);

    if (!result.valid) {
      setPromoError(result.message);
      setAppliedPromoCode(null);
      return;
    }

    setAppliedPromoCode(promoCode.trim().toUpperCase());
    setPromoMessage(result.message);
    toast.success(result.message);
  }

  async function handleContinueToPayment() {
    if (!consentAccepted) {
      toast.error("Please accept the Terms & Conditions and Privacy Policy to continue");
      return;
    }

    setConfirming(true);

    const checkoutResult = await confirmCheckoutStub();
    if (!checkoutResult.ok) {
      setConfirming(false);
      toast.error(checkoutResult.message);
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

    setConfirming(false);

    if (otpError) {
      toast.error(otpError.message);
      return;
    }

    updateState({ checkoutConfirmed: true });

    toast.success(
      accountResult.created
        ? "Payment confirmed. Check your email for a login code."
        : "Payment confirmed. We sent a login code to your email.",
    );

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

          <div className="grid min-h-0 flex-1 grid-cols-1 items-stretch gap-2 overflow-hidden lg:grid-cols-[1.65fr_1fr] lg:gap-4">
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
                <PaymentForm />
              </div>

              <TermsCheckbox checked={consentAccepted} onChange={setConsentAccepted} />
            </div>

            <OrderSummary
              medicationName={medicationName}
              planLabel={planLabel}
              medicationTotal={pricing.medicationTotal}
              subtotal={pricing.subtotal}
              processingFee={pricing.processingFee}
              discount={pricing.discount}
              discountLabel={pricing.discountLabel}
              total={pricing.total}
              promoCode={promoCode}
              promoMessage={promoMessage}
              promoError={promoError}
              applyingPromo={applyingPromo}
              consentAccepted={consentAccepted}
              confirming={confirming}
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
