"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { PackageDto } from "@/lib/intake/types";
import { cn } from "@/lib/utils";

type PricingCardProps = {
  pkg: PackageDto | null;
};

const DEFAULT_FEATURES = [
  "Medication Included",
  "Progress Tracking",
  "Personalized Treatment Plan",
  "Clinician Support",
  "Ongoing Monitoring",
];

/** Figma-style accordion — expands to show plan features. */
export default function PricingCard({ pkg }: PricingCardProps) {
  const [open, setOpen] = useState(false);

  if (!pkg) return null;

  const features = pkg.features.length > 0 ? pkg.features : DEFAULT_FEATURES;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-full onboarding-font">
      <div className="border-b border-[#E8EEED] pb-4">
        <CollapsibleTrigger
          type="button"
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <div className="min-w-0">
            <p className="text-[16px] font-medium leading-none text-[#152A51] sm:text-[18px]">
              What&apos;s included
            </p>
            <p className="mt-2 text-[13px] font-normal leading-snug text-[#152A51]/70 sm:text-[14px]">
              See everything that comes with your selected plan.
            </p>
          </div>
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E8EEED] bg-white text-[#152A51] transition"
            aria-hidden
          >
            <ChevronDown
              className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")}
            />
          </span>
        </CollapsibleTrigger>

        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-none">
          <div className="mt-4 overflow-hidden rounded-[14px] border border-[#E8EEED] bg-white px-4 py-2 sm:px-5">
            {features.map((feature) => (
              <div key={feature}>
                <hr className="border-[#E8EEED] first:hidden" />
                <p className="py-2.5 text-center text-[14px] font-normal text-[#152A51]">
                  {feature}
                </p>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
