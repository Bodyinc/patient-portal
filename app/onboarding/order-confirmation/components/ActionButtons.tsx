"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

type ActionButtonsProps = {
  dashboardHref?: string;
  treatmentHref?: string;
};

export default function ActionButtons({
  dashboardHref = "/dashboard",
  treatmentHref = "/shop",
}: ActionButtonsProps) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
      <Button
        type="button"
        onClick={() => router.push(dashboardHref)}
        className="h-10 w-full rounded-md bg-[#2E00AB] px-6 hover:bg-[#24008a] sm:w-auto"
      >
        Go to Dashboard
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>

      <Button
        type="button"
        variant="outline"
        onClick={() => router.push(treatmentHref)}
        className="h-10 w-full rounded-md border-[#2E00AB]/40 px-6 text-[#2E00AB] hover:bg-[#F8F7FC] sm:w-auto"
      >
        View Treatment Details
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}