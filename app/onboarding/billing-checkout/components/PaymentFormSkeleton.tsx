import { Lock } from "lucide-react";

import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-[#E8EEED]", className)} />;
}

export default function PaymentFormSkeleton({
  hint = "Preparing secure payment…",
}: {
  hint?: string;
}) {
  return (
    <div
      className="rounded-[14px] border border-[#E8E8E8] bg-white p-4 onboarding-font"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="mb-3 flex items-center justify-between border-b border-[#E8E8E8] pb-2">
        <h2 className="text-[15px] font-medium text-[#152A51] sm:text-[16px]">Payment Details</h2>
        <Lock size={16} className="text-[#152A51]/50" aria-hidden />
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <Bone className="h-3 w-24" />
          <Bone className="h-11 w-full rounded-[10px]" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Bone className="h-3 w-16" />
            <Bone className="h-11 w-full rounded-[10px]" />
          </div>
          <div className="space-y-2">
            <Bone className="h-3 w-12" />
            <Bone className="h-11 w-full rounded-[10px]" />
          </div>
        </div>
        <div className="space-y-2">
          <Bone className="h-3 w-20" />
          <Bone className="h-11 w-full rounded-[10px]" />
        </div>
        <Bone className="mt-1 h-[46px] w-full rounded-full" />
      </div>

      <p className="mt-3 text-center text-[12px] text-[#152A51]/70">{hint}</p>
    </div>
  );
}
