import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";

import OnboardingFooter from "./OnboardingFooter";
import OnboardingProgress from "./OnboardingProgress";

type OnboardingStepLayoutProps = {
  title: string;
  description?: string;
  children: ReactNode;
  onBack?: () => void;
  onContinue?: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  showBack?: boolean;
  showProgress?: boolean;
  maxWidth?: "md" | "lg" | "xl" | "2xl" | "4xl" | "7xl";
  /** Center compact steps vertically; use "fill" for taller content that fills middle zone. */
  layout?: "centered" | "fill";
};

const maxWidthClass = {
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "4xl": "max-w-4xl",
  "7xl": "max-w-7xl",
};

export default function OnboardingStepLayout({
  title,
  description,
  children,
  onBack,
  onContinue,
  continueLabel,
  continueDisabled,
  showBack,
  showProgress = true,
  maxWidth = "4xl",
  layout = "centered",
}: OnboardingStepLayoutProps) {
  const isCentered = layout === "centered";

  const middleZoneClass = isCentered
    ? "flex min-h-0 flex-1 flex-col justify-center"
    : "flex min-h-0 flex-1 flex-col justify-center";

  const cardClass = isCentered
    ? "shrink-0 overflow-hidden rounded-2xl border-[#2E00AB]/20 p-4 shadow-none sm:p-5"
    : "flex min-h-0 max-h-full shrink flex-col overflow-hidden rounded-2xl border-[#2E00AB]/20 p-3 shadow-none sm:p-4";

  const contentClass = isCentered ? "mt-3 sm:mt-4" : "mt-3 min-h-0 sm:mt-4";

  return (
    <div className={`mx-auto flex min-h-0 w-full flex-1 flex-col ${maxWidthClass[maxWidth]}`}>
      {showProgress ? <OnboardingProgress /> : null}

      <div className={middleZoneClass}>
        <Card className={cardClass}>
          <div className="shrink-0">
            <h1 className="text-lg font-semibold text-[#2E00AB] sm:text-xl lg:text-2xl">{title}</h1>
            {description ? (
              <p className="mt-1 text-sm text-[#2E00AB]/80 sm:text-base">{description}</p>
            ) : null}
          </div>

          <div className={contentClass}>{children}</div>
        </Card>
      </div>

      {onContinue ? (
        <OnboardingFooter
          onBack={onBack}
          onContinue={onContinue}
          continueLabel={continueLabel}
          continueDisabled={continueDisabled}
          showBack={showBack}
        />
      ) : null}
    </div>
  );
}
