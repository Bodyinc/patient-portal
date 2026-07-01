"use client";

import { useRouter } from "next/navigation";

import OnboardingShell from "../_components/OnboardingShell";
import OnboardingFooter from "../_components/OnboardingFooter";
import OnboardingFrame from "../_components/OnboardingFrame";
import PageHeader from "./components/PageHeader";
import InfoCard from "./components/InfoCard";
import PaymentForm from "./components/PaymentForm";
import OrderSummary from "./components/OrderSummary";
import TermsCheckbox from "./components/TermsCheckbox";
import {
  CONSULTATION_FEE,
  getMedicationById,
  getStateName,
  PLAN_PRICING,
} from "../_lib/onboarding-config";
import { getPrevStepPath } from "../_lib/onboarding-navigation";
import { useOnboarding } from "../_lib/onboarding-store";

export default function BillingCheckoutPage() {
  const router = useRouter();
  const { state } = useOnboarding();

  const medication = getMedicationById(state.medicationId);
  const plan = state.planMonths ? PLAN_PRICING[state.planMonths] : null;
  const medicationTotal = medication
    ? medication.priceMonthly * (state.planMonths === "3" ? 3 : 1)
    : 0;
  const subtotal = medicationTotal + CONSULTATION_FEE;
  const processingFee = 5;
  const discount = state.planMonths === "3" ? 22 : 0;
  const total = subtotal + processingFee - discount;

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
        <PageHeader />

        <div className="grid min-h-0 flex-1 grid-cols-1 items-stretch gap-3 lg:grid-cols-[1.65fr_1fr]">
          <div className="flex min-h-0 flex-col justify-center gap-2 lg:gap-3">
            <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoCard
                title="Patient Information"
                items={[
                  { label: "Name", value: state.fullName || "—" },
                  { label: "Email Address", value: state.email || "—" },
                  { label: "Phone Number", value: state.phone || "—" },
                ]}
              />

              <InfoCard
                title="Clinical Profile"
                items={[
                  { label: "State", value: getStateName(state.state) || "—" },
                  { label: "Date of Birth", value: state.dob || "—" },
                  { label: "BMI", value: state.bmi !== null ? String(state.bmi) : "—" },
                ]}
              />
            </div>

            <PaymentForm />
            <TermsCheckbox />
          </div>

          <OrderSummary
            medicationName={medication?.name ?? "Selected Medication"}
            planLabel={plan?.label ?? "Treatment Plan"}
            medicationTotal={medicationTotal}
            subtotal={subtotal}
            processingFee={processingFee}
            discount={discount}
            total={total}
          />
        </div>
      </OnboardingFrame>
    </OnboardingShell>
  );
}
