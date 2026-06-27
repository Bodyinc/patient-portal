import OnboardingShell from "../_components/OnboardingShell";
import PageHeader from "./components/PageHeader";
import PlanToggle from "./components/PlanToggle";
import PricingCard from "./components/PricingCard";
import FooterButtons from "./components/FooterButtons";

export default function SelectPlanPage() {
  return (
    <OnboardingShell>
      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-2 lg:px-6">
        <PageHeader />

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6">
          <PlanToggle />
          <PricingCard />
          <p className="max-w-xl shrink-0 text-center text-sm text-[#2E00AB]/80">
            *Clinical data suggests patients on 3+ month programs see 24% better outcomes on average
            compared to shorter duration.
          </p>
        </div>

        <FooterButtons />
      </div>
    </OnboardingShell>
  );
}
