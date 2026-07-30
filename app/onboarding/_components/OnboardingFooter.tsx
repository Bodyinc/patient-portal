"use client";

import { Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { debugLog } from "../_lib/debug-log";

type OnboardingFooterProps = {
  onBack?: () => void;
  onContinue?: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  showBack?: boolean;
  showContinue?: boolean;
  hint?: string;
  variant?: "default" | "figma";
};

export default function OnboardingFooter({
  onBack,
  onContinue,
  continueLabel = "Continue →",
  continueDisabled = false,
  showBack = true,
  showContinue = true,
  hint,
  variant = "default",
}: OnboardingFooterProps) {
  const isFigma = variant === "figma";

  const backButton = showBack ? (
    <Button
      type="button"
      variant="outline"
      onClick={() => onBack?.()}
      className={
        isFigma
          ? "h-[46px] w-full rounded-full border-[#152A51]/30 bg-transparent px-[19px] text-[14px] font-medium leading-none text-[#152A51] shadow-none hover:bg-[#152A51]/5 sm:w-auto"
          : "w-full border-[#152A51] text-[#152A51] sm:w-auto"
      }
    >
      ← Previous
    </Button>
  ) : null;

  const continueButton = showContinue ? (
    <Button
      type="button"
      onClick={() => {
        debugLog({
          runId: "post-fix-3",
          hypothesisId: "A",
          location: "OnboardingFooter.tsx:continue",
          message: "Continue clicked",
          data: { hasHandler: Boolean(onContinue), continueDisabled },
        });
        void Promise.resolve(onContinue?.()).catch((reason: unknown) => {
          debugLog({
            runId: "post-fix-3",
            hypothesisId: "B",
            location: "OnboardingFooter.tsx:continue-reject",
            message: "onContinue promise rejected",
            data: {
              reasonType: reason === null ? "null" : typeof reason,
              reasonString: String(reason),
              isEvent: typeof Event !== "undefined" && reason instanceof Event,
              eventType:
                typeof Event !== "undefined" && reason instanceof Event ? reason.type : undefined,
            },
          });
        });
      }}
      disabled={continueDisabled}
      className={
        isFigma
          ? "h-[46px] w-full rounded-full bg-[#E3E084] px-[19px] py-[14px] text-[14px] font-medium leading-none text-[#152A51] shadow-none hover:bg-[#D9D674] sm:w-auto"
          : "w-full bg-[#152A51] hover:bg-[#152A51]/90 sm:w-auto"
      }
    >
      {continueLabel}
    </Button>
  ) : null;

  return (
    <div className={cn("shrink-0", isFigma && "onboarding-font")}>
      <div
        className={cn(
          "flex gap-3",
          isFigma
            ? cn(
                "flex-col-reverse items-center",
                showBack && showContinue && "sm:flex-row sm:justify-center",
              )
            : showBack && showContinue
              ? "flex-col-reverse sm:flex-row sm:justify-between"
              : "flex-col sm:flex-row sm:justify-end",
        )}
      >
        {backButton}
        {continueButton}
      </div>

      {hint ? (
        <p className="mx-auto mt-4 flex max-w-[311px] items-start justify-center gap-1.5 text-center text-[10px] font-normal leading-4 text-[#152A51]/80">
          <Lock className="mt-0.5 h-3 w-3 shrink-0 text-[#E89B5C]" aria-hidden />
          <span>{hint}</span>
        </p>
      ) : null}
    </div>
  );
}
