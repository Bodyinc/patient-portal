import { Check } from "lucide-react";

export default function CheckoutReassurance() {
  return (
    <div className="mx-auto flex w-full max-w-[779px] min-h-[197px] items-center gap-6 rounded-[20px] bg-[#E8EEED] px-7 py-5 onboarding-font">
      <div className="h-[157px] w-[127px] shrink-0 overflow-hidden rounded-[12px] bg-#FFFFFF">
        <img src="/woman_white.svg" alt="" className="h-full w-full object-cover object-center" />
      </div>

      <div className="max-w-[430px] space-y-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#6A9B9C] px-2.5 py-1 text-[11px] font-medium leading-none text-white">
          <Check className="h-3 w-3 stroke-[3]" aria-hidden />
          You&apos;re in good hands
        </span>
        <p className="text-[16px] leading-8 text-[#152A51]/80">
          Your treatment plan is personalized based on your health assessment. Our licensed
          providers are here to support you every step of the way.
        </p>
      </div>
    </div>
  );
}
