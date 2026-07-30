"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export default function ActionButtons() {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
      <Button
        type="button"
        onClick={() => router.push("/dashboard")}
        className="h-10 w-full rounded-md bg-[#152A51] px-6 hover:bg-[#10213F] sm:w-auto"
      >
        Go to Dashboard
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>

      <Button
        type="button"
        variant="outline"
        className="h-10 w-full rounded-md border-[#152A51]/40 px-6 text-[#152A51] sm:w-auto"
      >
        View Treatment Details
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}
