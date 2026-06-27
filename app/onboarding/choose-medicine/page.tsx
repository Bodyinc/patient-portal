import OnboardingShell from "../_components/OnboardingShell";
import PageHeader from "./components/PageHeader";
import MedicationGrid from "./components/MedicationGrid";
import FooterButtons from "./components/FooterButtons";

export default function ChooseMedicationPage() {
  return (
    <OnboardingShell>
      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col px-2 lg:px-6">
        <PageHeader />
        <MedicationGrid />
        <FooterButtons />
      </div>
    </OnboardingShell>
  );
}
