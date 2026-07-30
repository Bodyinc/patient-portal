import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import OnboardingFooter from "./OnboardingFooter";
import OnboardingFrame from "./OnboardingFrame";

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
  maxWidth?: "md" | "lg" | "xl" | "2xl" | "4xl" | "7xl" | "form";
  /** Center compact steps vertically; use "fill" for taller content that fills middle zone. */
  layout?: "centered" | "fill";
  /** Card chrome vs bare Figma-style form surface. */
  variant?: "card" | "bare";
  /** Title / description alignment. */
  align?: "left" | "center";
  titleClassName?: string;
  descriptionClassName?: string;
  footerHint?: string;
};

const maxWidthClass = {
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "4xl": "max-w-4xl",
  "7xl": "max-w-7xl",
  form: "max-w-[649px]",
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
  variant = "card",
  align = "left",
  titleClassName,
  descriptionClassName,
  footerHint,
}: OnboardingStepLayoutProps) {
  const isCentered = layout === "centered";
  const isBare = variant === "bare";
  const textAlign = align === "center" ? "text-center" : "text-left";

  const cardClass = isBare
    ? cn(
        "border-0 bg-transparent p-0 shadow-none",
        isCentered ? "shrink-0" : "flex min-h-0 flex-1 flex-col overflow-hidden",
      )
    : isCentered
      ? "shrink-0 overflow-hidden rounded-2xl border-[#152A51]/20 p-4 shadow-none sm:p-5"
      : "flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border-[#152A51]/20 p-3 shadow-none sm:p-4";

  const contentClass = isCentered
    ? isBare
      ? "mt-4 sm:mt-10"
      : "mt-3 sm:mt-4"
    : isBare
      ? "mt-6 min-h-0 flex-1 overflow-y-auto scrollbar-hide sm:mt-8"
      : "mt-3 min-h-0 flex-1 overflow-y-auto scrollbar-hide sm:mt-4";

  const footer = onContinue ? (
    <OnboardingFooter
      onBack={onBack}
      onContinue={onContinue}
      continueLabel={continueLabel}
      continueDisabled={continueDisabled}
      showBack={showBack}
      hint={footerHint}
      variant={isBare ? "figma" : "default"}
    />
  ) : undefined;

  return (
    <OnboardingFrame showProgress={showProgress} footer={footer}>
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          isCentered ? "justify-center -translate-y-4 sm:-translate-y-4" : "overflow-hidden",
        )}
      >
        <Card className={`mx-auto w-full ${maxWidthClass[maxWidth]} ${cardClass}`}>
          <div className={cn("shrink-0 onboarding-font", textAlign)}>
            <h1
              className={cn(
                isBare
                  ? "text-[28px] font-medium leading-none tracking-[-0.5px] text-[#152A51] sm:text-[32px]"
                  : "text-lg font-semibold text-[#152A51] sm:text-xl lg:text-2xl",
                titleClassName,
              )}
            >
              {title}
            </h1>
            {description ? (
              <p
                className={cn(
                  isBare
                    ? "mt-3.5 text-[14px] font-normal leading-snug text-[#152A51]/80"
                    : "mt-1 text-sm text-[#152A51]/80 sm:text-base",
                  descriptionClassName,
                )}
              >
                {description}
              </p>
            ) : null}
          </div>

          <div className={cn(contentClass, "onboarding-font")}>{children}</div>
        </Card>
      </div>
    </OnboardingFrame>
  );
}
