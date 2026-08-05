import OnboardingShell from "./_components/OnboardingShell";
import { OnboardingProvider } from "./_lib/onboarding-store";
import "./onboarding.css";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingProvider>
      <OnboardingShell>{children}</OnboardingShell>
    </OnboardingProvider>
  );
}
