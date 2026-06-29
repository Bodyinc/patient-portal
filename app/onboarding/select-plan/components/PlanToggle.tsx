"use client";

import type { PlanMonths } from "../../_lib/onboarding-config";

type PlanToggleProps = {
  value: PlanMonths | null;
  onChange: (value: PlanMonths) => void;
};

export default function PlanToggle({ value, onChange }: PlanToggleProps) {
  const selected = value ?? "3";

  return (
    <div className="flex w-full shrink-0 justify-center sm:w-auto">
      <div className="flex w-full overflow-hidden rounded-md border border-[#2E00AB]/30 sm:w-auto">
        <button
          type="button"
          onClick={() => onChange("1")}
          className={`flex-1 px-4 py-3 text-sm font-semibold transition sm:flex-none sm:px-8 ${
            selected === "1" ? "bg-[#E6DEFF] text-[#2E00AB]" : "bg-white text-[#2E00AB]"
          }`}
        >
          1 Month Plan
        </button>

        <button
          type="button"
          onClick={() => onChange("3")}
          className={`flex-1 px-4 py-3 text-sm font-semibold transition sm:flex-none sm:px-8 ${
            selected === "3" ? "bg-[#E6DEFF] text-[#2E00AB]" : "bg-white text-[#2E00AB]"
          }`}
        >
          3 Month Plan
        </button>
      </div>
    </div>
  );
}
