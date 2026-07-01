import type { ReactNode } from "react";

import OnboardingProgress from "./OnboardingProgress";

type OnboardingFrameProps = {
  children: ReactNode;
  footer?: ReactNode;
  showProgress?: boolean;
};

export default function OnboardingFrame({
  children,
  footer,
  showProgress = true,
}: OnboardingFrameProps) {
  return (
    <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col overflow-hidden px-2 lg:px-6">
      {showProgress ? <OnboardingProgress /> : null}
      {children}
      {footer}
    </div>
  );
}
