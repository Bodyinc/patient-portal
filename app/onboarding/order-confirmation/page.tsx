import OnboardingShell from "../_components/OnboardingShell";
import ConfirmationHeader from "./components/ConfirmationHeader";
import OrderSummary from "./components/OrderSummary";
import ActionButtons from "./components/ActionButtons";

export default function OrderConfirmationPage() {
  return (
    <OnboardingShell>
      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col justify-center gap-6">
        <ConfirmationHeader />
        <OrderSummary />
        <ActionButtons />
      </div>
    </OnboardingShell>
  );
}
