"use client";

import { Check } from "lucide-react";

import type { PackageDto } from "@/lib/intake/types";
import { cn } from "@/lib/utils";

type PlanToggleProps = {
  packages: PackageDto[];
  selectedPackageId: string | null;
  onChange: (packageId: string) => void;
};

function formatMoney(amount: number) {
  return `$${Math.round(amount)}`;
}

export default function PlanToggle({ packages, selectedPackageId, onChange }: PlanToggleProps) {
  if (packages.length === 0) return null;

  return (
    <div className="flex w-full flex-col gap-4 onboarding-font">
      <h2 className="text-left text-[16px] font-medium text-[#152A51] sm:text-[18px]">
        Maximize results &amp; savings
      </h2>

      <div className="flex w-full flex-col gap-3">
        {packages.map((pkg) => {
          const selected = selectedPackageId === pkg.id;
          const savings = pkg.originalPrice > pkg.price ? pkg.originalPrice - pkg.price : 0;
          const monthly = pkg.durationMonths > 0 ? pkg.price / pkg.durationMonths : pkg.price;
          const showRecommended = pkg.isMostPopular;

          return (
            <button
              key={pkg.id}
              type="button"
              onClick={() => onChange(pkg.id)}
              aria-pressed={selected}
              className={cn(
                "relative w-full rounded-[14px] border bg-white px-4 py-4 text-left sm:px-5 sm:py-5",
                selected
                  ? "border-[#152A51] shadow-[0_2px_12px_rgba(21,42,81,0.08)]"
                  : "border-[#E8E8E8] hover:border-[#152A51]/30",
              )}
            >
              {showRecommended ? (
                <span className="absolute mt-0.5 -top-0.5 left-15 rounded-[10px] rounded-t-none bg-[#6A9B9C] px-4 py-2 text-[12px] font-medium leading-none text-white">
                  Recommended
                </span>
              ) : null}

              <div className="flex mt-5 items-start gap-3 sm:gap-4">
                <span
                  className={cn(
                    "mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                    selected ? "border-[#152A51] bg-[#152A51]" : "border-[#D4D4D4] bg-white",
                  )}
                  aria-hidden
                >
                  {selected ? <Check className="h-3 w-3 text-white stroke-[3]" /> : null}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0">
                      <p className="text-[16px] font-medium leading-none text-[#152A51] sm:text-[18px]">
                        {pkg.durationMonths} Month supply
                      </p>
                      <p className="mt-2 text-[13px] font-normal text-[#152A51]/70">{pkg.name}</p>

                      {savings > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="inline-flex items-center rounded-full bg-[#E0FAE8] px-2.5 py-1.5 text-[12px] font-medium uppercase leading-none text-[#34845F]">
                            Save ${Math.round(savings)} today
                          </span>
                        </div>
                      ) : null}
                    </div>

                    <div className="shrink-0 text-left sm:text-right">
                      <p className="text-[22px] font-medium leading-none tracking-[-0.5px] text-[#152A51] sm:text-[24px]">
                        {formatMoney(monthly)}
                        <span className="text-[14px] font-normal">/mo</span>
                      </p>
                      {pkg.originalPrice > pkg.price ? (
                        <p className="mt-1.5 text-[13px] text-[#152A51]/50 line-through">
                          {formatMoney(pkg.originalPrice / Math.max(pkg.durationMonths, 1))}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
