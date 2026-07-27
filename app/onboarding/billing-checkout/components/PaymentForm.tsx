import { Lock } from "lucide-react";

export default function PaymentForm() {
  return (
    <div className="rounded-[14px] border border-[#E8E8E8] bg-white p-4 onboarding-font">
      <div className="mb-3 flex items-center justify-between border-b border-[#E8E8E8] pb-2">
        <h2 className="text-[15px] font-medium text-[#152A51] sm:text-[16px]">Payment Details</h2>
        <Lock size={16} className="text-[#152A51]" />
      </div>
      <p className="text-[13px] leading-relaxed text-[#152A51]/70">
        Your card details are collected securely by Stripe. Review your order, then select{" "}
        <span className="font-medium text-[#152A51]">Continue to Payment</span> to enter your card.
      </p>
    </div>
  );
}
