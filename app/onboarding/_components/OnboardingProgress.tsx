"use client";

import { usePathname } from "next/navigation";

import { getProgressForPath } from "../_lib/onboarding-navigation";

export default function OnboardingProgress() {
  const pathname = usePathname();
  const { current, total, percent } = getProgressForPath(pathname);

  if (current === 0) return null;

  return (
    <div className="mb-2 shrink-0 sm:mb-3">
      <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm text-[#2E00AB]">
        <span>
          Step {current} of {total}
        </span>
        <span>{percent}% Complete</span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-[#2E00AB]/15"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-[#2E00AB] transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
