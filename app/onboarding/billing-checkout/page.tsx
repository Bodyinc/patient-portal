import PageHeader from "./components/PageHeader";
import InfoCard from "./components/InfoCard";
import PaymentForm from "./components/PaymentForm";
import OrderSummary from "./components/OrderSummary";
import TermsCheckbox from "./components/TermsCheckbox";
import Image from "next/image";
export default function BillingCheckoutPage() {
  return (
    <main className="min-h-screen bg-white px-8 py-10">
      <Image
        src="/background-curve.svg"
        alt=""
        fill
        className="pointer-events-none object-cover opacity-40"
      />
      <PageHeader />

      <div className="mx-auto mt-10 grid max-w-7xl grid-cols-3 gap-6">
        <div className="col-span-2">
          <div className="grid grid-cols-2 gap-6">
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
                {
                  label: "Street Address",
                  value: "123 Wellness Way, Apt 4B",
                },
                {
                  label: "City & State",
                  value: "San Francisco, CA 94105",
                },
                {
                  label: "Country",
                  value: "United States",
                },
              ]}
            />
          </div>

          <PaymentForm />

          <TermsCheckbox />
        </div>

        <OrderSummary />
      </div>
    </main>
  );
}
