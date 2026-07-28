"use client";

import { usePathname } from "next/navigation";

import { getProgressForPath } from "../_lib/onboarding-navigation";

export default function OnboardingProgress() {
  const pathname = usePathname();
  const { current, total, percent } = getProgressForPath(pathname);

  if (current === 0) return null;

  return (
    <div className="mb-3 shrink-0 sm:mb-4">
      <div className="mb-2 flex flex-wrap justify-between gap-2 text-[12px] text-[#152A51]/80 onboarding-font sm:text-sm">
        <span>
          Step {current} of {total}
        </span>
        <span>{percent}% Complete</span>
      </div>
      <div
        className="h-[3px] w-full overflow-hidden rounded-full bg-[#E9EBEF]"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Step ${current} of ${total}`}
      >
        <div
          className="h-full rounded-full bg-[#152A51] transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
