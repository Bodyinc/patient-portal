"use client";

import type { PackageDto } from "@/lib/intake/types";

type PlanToggleProps = {
  packages: PackageDto[];
  selectedPackageId: string | null;
  onChange: (packageId: string) => void;
};

export default function PlanToggle({ packages, selectedPackageId, onChange }: PlanToggleProps) {
  const selected =
    packages.find((p) => p.id === selectedPackageId) ?? packages[packages.length - 1] ?? null;

  return (
    <div className="flex w-full shrink-0 justify-center sm:w-auto">
      <div className="flex w-full overflow-hidden rounded-md border border-[#2E00AB]/30 sm:w-auto">
        {packages.map((pkg) => (
          <button
            key={pkg.id}
            type="button"
            onClick={() => onChange(pkg.id)}
            className={`flex-1 px-4 py-3 text-sm font-semibold transition sm:flex-none sm:px-8 ${
              selected?.id === pkg.id ? "bg-[#E6DEFF] text-[#2E00AB]" : "bg-white text-[#2E00AB]"
            }`}
          >
            {pkg.durationMonths} Month Plan
          </button>
        ))}
      </div>
    </div>
  );
}
