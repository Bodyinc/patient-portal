"use client";

import { Button } from "@/components/ui/button";

type OnboardingFooterProps = {
  onBack?: () => void;
  onContinue?: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  showBack?: boolean;
  showContinue?: boolean;
};

export default function OnboardingFooter({
  onBack,
  onContinue,
  continueLabel = "Continue →",
  continueDisabled = false,
  showBack = true,
  showContinue = true,
}: OnboardingFooterProps) {
  return (
    <div className="mt-4 shrink-0 pt-0 pb-1 sm:mt-5 sm:pb-2">
      <div
        className={`flex gap-3 ${showBack && showContinue ? "flex-col-reverse sm:flex-row sm:justify-between" : "flex-col sm:flex-row sm:justify-end"}`}
      >
        {showBack ? (
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="w-full border-[#2E00AB] text-[#2E00AB] sm:w-auto"
          >
            ← Previous
          </Button>
        ) : null}

        {showContinue ? (
          <Button
            type="button"
            onClick={onContinue}
            disabled={continueDisabled}
            className="w-full bg-[#2E00AB] hover:bg-[#2E00AB]/90 sm:w-auto"
          >
            {continueLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
