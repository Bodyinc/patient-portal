"use client";

import Link from "next/link";
import { Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { markOnboardingNavigation } from "../_lib/onboarding-navigation";

type OnboardingFooterProps = {
  onBack?: () => void;
  backHref?: string | null;
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
  backHref,
  onContinue,
  continueLabel = "Continue →",
  continueDisabled = false,
  showBack = true,
  showContinue = true,
  hint,
  variant = "default",
}: OnboardingFooterProps) {
  const isFigma = variant === "figma";

  const backClassName = isFigma
    ? "h-[46px] w-full rounded-full border-[#152A51]/30 bg-transparent px-[19px] text-[14px] font-medium leading-none text-[#152A51] shadow-none hover:bg-[#152A51]/5 sm:w-auto"
    : "w-full border-[#152A51] text-[#152A51] sm:w-auto";

  const backButton = showBack ? (
    backHref ? (
      <Button asChild variant="outline" className={backClassName}>
        <Link href={backHref} prefetch onClick={() => markOnboardingNavigation()}>
          ← Previous
        </Link>
      </Button>
    ) : (
      <Button type="button" variant="outline" onClick={() => onBack?.()} className={backClassName}>
        ← Previous
      </Button>
    )
  ) : null;

  const continueButton = showContinue ? (
    <Button
      type="button"
      onClick={() => {
        void Promise.resolve(onContinue?.()).catch(() => {});
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
