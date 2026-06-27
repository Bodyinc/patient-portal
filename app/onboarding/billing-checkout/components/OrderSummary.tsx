"use client";

import { useRouter } from "next/navigation";

export default function OrderSummary() {
  const router = useRouter();

  return (
    <div className="flex flex-col self-start rounded-[20px] border border-[#2E00AB]/20 bg-white p-5">
      <h2 className="shrink-0 border-b border-[#2E00AB]/10 pb-3 text-xl font-semibold text-[#2E00AB]">
        Order Summary
      </h2>

      <div className="mt-3 flex flex-col gap-3">
        <div className="flex justify-between gap-4">
          <div>
            <p className="text-base font-medium text-[#2E00AB]">Personalized Wellness Plan</p>
            <p className="mt-0.5 text-sm text-[#2E00AB]/70">3-Month Membership Program</p>
          </div>
          <p className="shrink-0 text-base font-semibold text-[#2E00AB]">$149.00</p>
        </div>

        <div className="flex justify-between gap-4 border-b border-[#2E00AB]/10 pb-3">
          <div>
            <p className="text-base font-medium text-[#2E00AB]">Initial Provider Consultation</p>
            <p className="mt-0.5 text-sm text-[#2E00AB]/70">Required Clinical Assessment</p>
          </div>
          <p className="shrink-0 text-base font-semibold text-[#2E00AB]">$35.00</p>
        </div>

        <div className="space-y-2 text-sm text-[#2E00AB]">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>$184.00</span>
          </div>
          <div className="flex justify-between">
            <span>Processing Fee</span>
            <span>$5.00</span>
          </div>
          <div className="flex justify-between">
            <span>Discount (WELCOME20)</span>
            <span>-$22.00</span>
          </div>
          <div className="flex justify-between">
            <span>Tax</span>
            <span>$0.00</span>
          </div>
        </div>

        <hr className="border-[#2E00AB]/10" />

        <div className="flex items-center justify-between">
          <p className="text-base font-medium text-[#2E00AB]">Total Due Today</p>
          <p className="text-3xl font-bold leading-none text-[#2E00AB]">$167.00</p>
        </div>

        <div className="flex gap-2">
          <input
            placeholder="Enter promo code"
            className="flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#2E00AB]"
          />
          <button
            type="button"
            className="shrink-0 rounded-md border border-[#2E00AB] px-4 py-2 text-sm text-[#2E00AB]"
          >
            Apply Code →
          </button>
        </div>

        <button
          type="button"
          onClick={() => router.push("/onboarding/order-confirmation")}
          className="w-full rounded-md bg-[#2E00AB] py-3 text-base font-semibold text-white"
        >
          Continue to Payment
        </button>

        <p className="text-center text-xs text-[#2E00AB]/70">
          Need assistance? <span className="font-semibold">Chat with Support</span>
        </p>
      </div>
    </div>
  );
}
