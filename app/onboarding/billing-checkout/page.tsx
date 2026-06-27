import OnboardingShell from "../_components/OnboardingShell";
import PageHeader from "./components/PageHeader";
import InfoCard from "./components/InfoCard";
import PaymentForm from "./components/PaymentForm";
import OrderSummary from "./components/OrderSummary";
import TermsCheckbox from "./components/TermsCheckbox";

export default function BillingCheckoutPage() {
  return (
    <OnboardingShell>
      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col overflow-hidden px-2 lg:px-6">
        <PageHeader />

        <div className="grid min-h-0 flex-1 grid-cols-1 items-start gap-4 overflow-y-auto lg:grid-cols-[1.65fr_1fr] lg:overflow-hidden">
          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto lg:overflow-hidden">
            <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoCard
                title="Patient Information"
                items={[
                  { label: "Name", value: "John Doe" },
                  { label: "Email Address", value: "patient@example.com" },
                  { label: "Phone Number", value: "(555) 000-0000" },
                ]}
              />

              <InfoCard
                title="Billing Address"
                items={[
                  { label: "Street Address", value: "123 Wellness Way, Apt 4B" },
                  { label: "City & State", value: "San Francisco, CA 94105" },
                  { label: "Country", value: "United States" },
                ]}
              />
            </div>

            <PaymentForm />
            <TermsCheckbox />
          </div>

          <OrderSummary />
        </div>
      </div>
    </OnboardingShell>
  );
}
