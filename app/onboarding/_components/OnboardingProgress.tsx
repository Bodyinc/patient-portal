"use client";

import { usePathname } from "next/navigation";

import { Progress } from "@/components/ui/progress";

import { getProgressForPath } from "../_lib/onboarding-navigation";

export default function OnboardingProgress() {
  const pathname = usePathname();
  const { current, total, percent } = getProgressForPath(pathname);

  if (current === 0) return null;

  return (
    <div className="mt-1 mb-3 shrink-0 sm:mt-2 sm:mb-4">
      <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm text-[#2E00AB]">
        <span>
          Step {current} of {total}
        </span>
        <span>{percent}% Complete</span>
      </div>
      <Progress value={percent} className="h-1.5 rounded-full" />
    </div>
  );
}
