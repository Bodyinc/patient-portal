import { Lock } from "lucide-react";

export default function PaymentForm() {
  return (
    <div className="rounded-[12px] border border-[#2E00AB]/20 bg-white p-3">
      <div className="mb-2 flex items-center justify-between border-b border-[#2E00AB]/10 pb-1.5">
        <h2 className="text-sm font-semibold text-[#2E00AB] sm:text-base">Payment Details</h2>
        <Lock size={16} className="text-[#2E00AB]" />
      </div>
      <p className="text-xs text-[#2E00AB]/70">
        Your card details are collected securely by Stripe. Review your order, then select{" "}
        <span className="font-semibold">Continue to Payment</span> to enter your card.
      </p>
    </div>
  );
}
