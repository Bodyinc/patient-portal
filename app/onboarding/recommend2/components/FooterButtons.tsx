"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function FooterButtons() {
  const router = useRouter();

  return (
    <div className="mt-auto flex shrink-0 flex-col-reverse gap-3 pt-4 sm:flex-row sm:justify-between">
      <Button
        type="button"
        variant="outline"
        onClick={() => router.push("/onboarding/quiz")}
        className="w-full border-[#2E00AB]/40 text-[#2E00AB] sm:w-auto"
      >
        ← Previous
      </Button>

      <Button
        type="button"
        onClick={() => router.push("/onboarding/select-plan")}
        className="w-full bg-[#2E00AB] hover:bg-[#25008f] sm:w-auto"
      >
        Continue →
      </Button>
    </div>
  );
}
